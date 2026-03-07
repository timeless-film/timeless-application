"use client";

import { Loader2, Shield, ShieldAlert, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getMembers, removeMember, updateMemberRole } from "./actions";

interface MemberInfo {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt: Date;
  isCurrentUser: boolean;
}

const ROLE_ICONS = {
  owner: ShieldAlert,
  admin: Shield,
  member: User,
} as const;

interface MembersListProps {
  initialMembers: MemberInfo[];
  initialCurrentUserRole?: string;
}

export function MembersList({ initialMembers, initialCurrentUserRole }: MembersListProps) {
  const t = useTranslations("members");

  const [members, setMembers] = useState<MemberInfo[]>(initialMembers as MemberInfo[]);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(
    initialCurrentUserRole
  );
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadMembers() {
    setLoading(true);
    const result = await getMembers();
    if (result.members) {
      setMembers(result.members as MemberInfo[]);
    }
    if (result.currentUserRole) {
      setCurrentUserRole(result.currentUserRole);
    }
    setLoading(false);
  }

  async function handleRoleChange(memberId: string, newRole: "admin" | "member") {
    setActionLoading(memberId);
    const result = await updateMemberRole(memberId, newRole);
    if (result.error) {
      toast.error(t("error.updateFailed"));
    } else {
      toast.success(t("roleUpdated"));
      await loadMembers();
    }
    setActionLoading(null);
  }

  async function handleRemove(memberId: string) {
    setActionLoading(memberId);
    const result = await removeMember(memberId);
    if (result.error) {
      toast.error(t("error.removeFailed"));
    } else {
      toast.success(t("memberRemoved"));
      await loadMembers();
    }
    setActionLoading(null);
  }

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => {
            const RoleIcon = ROLE_ICONS[member.role];
            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <RoleIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {member.name}
                      {member.isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">({t("you")})</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground capitalize">
                    {t(`role.${member.role}`)}
                  </span>
                  {canManage && member.role !== "owner" && !member.isCurrentUser && (
                    <div className="flex items-center gap-1">
                      {actionLoading === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {member.role === "member" && currentUserRole === "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("promoteToAdmin")}
                              onClick={() => handleRoleChange(member.id, "admin")}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          {member.role === "admin" && currentUserRole === "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("demoteToMember")}
                              onClick={() => handleRoleChange(member.id, "member")}
                            >
                              <User className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("removeMember")}
                            onClick={() => handleRemove(member.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
