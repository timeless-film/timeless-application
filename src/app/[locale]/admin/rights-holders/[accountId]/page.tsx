"use client";

import { ArrowLeft, Film, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getAccountDetailAction,
  reactivateRightsHolderAction,
  suspendRightsHolderAction,
  updateCommissionRateAction,
} from "@/app/[locale]/admin/rights-holders/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCountryOptions } from "@/lib/countries";
import { formatAmount } from "@/lib/pricing/format";

import type {
  AccountOrderRow,
  AccountRequestRow,
  AccountSalesTotals,
} from "@/lib/services/admin-accounts-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccountDetail {
  account: {
    id: string;
    companyName: string;
    country: string;
    status: "active" | "suspended";
    contactEmail: string | null;
    contactPhone: string | null;
    vatNumber: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    commissionRate: string | null;
    stripeConnectOnboardingComplete: boolean | null;
    stripeConnectAccountId: string | null;
    onboardingCompleted: boolean;
    createdAt: Date;
  };
  members: {
    userId: string;
    role: string;
    createdAt: Date;
    name: string;
    email: string;
  }[];
  activeFilmCount: number;
  orderItemCount: number;
  cinemaCount: number;
  commissionHistory: {
    id: string;
    action: string;
    metadata: string | null;
    createdAt: Date;
  }[];
  orders: AccountOrderRow[];
  requests: AccountRequestRow[];
  salesTotals: AccountSalesTotals;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RightsHolderDetailPage() {
  const t = useTranslations("admin.rightsHolders");
  const tDetail = useTranslations("admin.rightsHolders.detail");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ accountId: string }>();
  const countryOptions = getCountryOptions(locale);
  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Suspend/reactivate
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [acting, setActing] = useState(false);

  // Commission edit
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionValue, setCommissionValue] = useState("");
  const [updatingCommission, setUpdatingCommission] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    const result = await getAccountDetailAction(params.accountId);
    if ("error" in result) {
      toast.error(t("error.unexpected"));
      setLoading(false);
      return;
    }
    setDetail(result.data as AccountDetail);
    setLoading(false);
  }, [params.accountId, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  function getCountryName(code: string) {
    return countryOptions.find((c) => c.value === code)?.label ?? code;
  }

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatOrderNumber(num: number) {
    return `ORD-${String(num).padStart(6, "0")}`;
  }

  async function handleSuspendToggle() {
    if (!detail) return;
    setActing(true);
    try {
      const isSuspended = detail.account.status === "suspended";
      const result = isSuspended
        ? await reactivateRightsHolderAction(detail.account.id)
        : await suspendRightsHolderAction(detail.account.id);
      if ("error" in result) {
        toast.error(t("error.unexpected"));
      } else {
        toast.success(isSuspended ? t("reactivated") : t("suspended"));
        fetchDetail();
      }
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setActing(false);
      setSuspendOpen(false);
    }
  }

  async function handleCommissionUpdate() {
    if (!detail) return;
    setUpdatingCommission(true);
    try {
      const val = commissionValue.trim();
      const rate = val === "" ? null : parseFloat(val);
      if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
        toast.error(t("error.invalidCommission"));
        setUpdatingCommission(false);
        return;
      }
      const result = await updateCommissionRateAction(detail.account.id, rate);
      if ("error" in result) {
        toast.error(t("error.unexpected"));
      } else {
        toast.success(t("commissionUpdated"));
        setCommissionOpen(false);
        fetchDetail();
      }
    } catch {
      toast.error(t("error.unexpected"));
    } finally {
      setUpdatingCommission(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push(`/${locale}/admin/rights-holders`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("title")}
        </Button>
        <p className="text-muted-foreground">{t("noResults")}</p>
      </div>
    );
  }

  const {
    account,
    members,
    activeFilmCount,
    orderItemCount,
    commissionHistory,
    orders: accountOrders,
    requests: accountRequests,
    salesTotals,
  } = detail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/${locale}/admin/rights-holders`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl">{account.companyName}</h1>
            <p className="text-muted-foreground text-sm">{getCountryName(account.country)}</p>
          </div>
          <Badge variant={account.status === "active" ? "default" : "destructive"}>
            {t(`status.${account.status}`)}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCommissionValue(
                account.commissionRate ? (parseFloat(account.commissionRate) * 100).toFixed(0) : ""
              );
              setCommissionOpen(true);
            }}
          >
            {t("editCommission")}
          </Button>
          <Button
            variant={account.status === "active" ? "destructive" : "default"}
            onClick={() => setSuspendOpen(true)}
          >
            {account.status === "active" ? t("suspend") : t("reactivate")}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{tDetail("info")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("email")}</dt>
                <dd>{account.contactEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("phone")}</dt>
                <dd>{account.contactPhone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("address")}</dt>
                <dd>
                  {[account.address, account.postalCode, account.city].filter(Boolean).join(", ") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("vat")}</dt>
                <dd>{account.vatNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("created")}</dt>
                <dd>{formatDate(account.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tDetail("stats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("activeFilms")}</dt>
                <dd className="text-lg font-bold">{activeFilmCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("totalSales")}</dt>
                <dd className="text-lg font-bold">{orderItemCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{tDetail("volume")}</dt>
                <dd className="text-lg font-bold">
                  {formatAmount(salesTotals.totalVolume, "EUR", locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{t("columns.commission")}</dt>
                <dd className="text-lg font-bold">
                  {account.commissionRate
                    ? `${(parseFloat(account.commissionRate) * 100).toFixed(0)}%`
                    : `${t("defaultRate")}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">{t("columns.stripe")}</dt>
                <dd>
                  <Badge
                    variant={account.stripeConnectOnboardingComplete ? "default" : "secondary"}
                  >
                    {account.stripeConnectOnboardingComplete
                      ? t("stripeStatus.complete")
                      : t("stripeStatus.incomplete")}
                  </Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>
            {tDetail("members")} ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tDetail("memberName")}</TableHead>
                <TableHead>{tDetail("memberEmail")}</TableHead>
                <TableHead>{tDetail("memberRole")}</TableHead>
                <TableHead>{tDetail("memberSince")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.role}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(m.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Commission history */}
      {commissionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tDetail("commissionHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tDetail("date")}</TableHead>
                  <TableHead>{tDetail("change")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionHistory.map((log) => {
                  const meta = log.metadata ? JSON.parse(log.metadata) : null;
                  const oldRate = meta?.oldRate
                    ? `${(parseFloat(meta.oldRate) * 100).toFixed(0)}%`
                    : t("defaultRate");
                  const newRate = meta?.newRate
                    ? `${(parseFloat(meta.newRate) * 100).toFixed(0)}%`
                    : t("defaultRate");
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        {oldRate} → {newRate}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Orders */}
      <Card>
        <CardHeader>
          <CardTitle>
            {tDetail("orderList")} ({accountOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountOrders.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">{tDetail("noOrders")}</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">{tDetail("orderNumber")}</TableHead>
                  <TableHead className="w-[18%]">{tDetail("orderDate")}</TableHead>
                  <TableHead className="w-[12%] text-center">{tDetail("items")}</TableHead>
                  <TableHead className="w-[18%] text-right">{tDetail("total")}</TableHead>
                  <TableHead className="w-[14%]">{tDetail("orderStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountOrders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/orders/${order.orderId}`}
                        className="text-primary font-mono text-sm hover:underline"
                      >
                        {formatOrderNumber(order.orderNumber)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(order.paidAt)}
                    </TableCell>
                    <TableCell className="text-center">{order.itemCount}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatAmount(order.total, order.currency, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tDetail(`orderStatusValues.${order.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Requests */}
      <Card>
        <CardHeader>
          <CardTitle>
            {tDetail("requestList")} ({accountRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountRequests.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {tDetail("noRequests")}
            </p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">{tDetail("film")}</TableHead>
                  <TableHead className="w-[25%]">{tDetail("counterparty")}</TableHead>
                  <TableHead className="w-[15%] text-right">{tDetail("amount")}</TableHead>
                  <TableHead className="w-[15%]">{tDetail("requestStatusCol")}</TableHead>
                  <TableHead className="w-[20%]">{tDetail("requestDate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/films/${req.filmId}`}
                        className="flex items-center gap-3 hover:underline"
                      >
                        {req.filmPosterUrl ? (
                          <Image
                            src={req.filmPosterUrl}
                            alt={req.filmTitle}
                            width={32}
                            height={48}
                            className="h-12 w-8 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="bg-muted flex h-12 w-8 shrink-0 items-center justify-center rounded">
                            <Film className="text-muted-foreground h-4 w-4" />
                          </div>
                        )}
                        <span className="text-primary truncate font-medium">{req.filmTitle}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="truncate text-sm">
                      <Link
                        href={`/${locale}/admin/exhibitors/${req.counterpartyAccountId}`}
                        className="text-primary hover:underline"
                      >
                        {req.counterpartyName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatAmount(req.displayedPrice, req.currency, locale)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/${locale}/admin/requests/${req.id}`}
                        className="hover:underline"
                      >
                        <Badge variant="outline">{tDetail(`reqStatus.${req.status}`)}</Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(req.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suspend/Reactivate dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {account.status === "suspended" ? t("reactivate") : t("suspend")}
            </DialogTitle>
            <DialogDescription>
              {account.status === "suspended"
                ? t("reactivateConfirm", { name: account.companyName })
                : t("suspendConfirm", { name: account.companyName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)} disabled={acting}>
              {t("cancel")}
            </Button>
            <Button
              variant={account.status === "suspended" ? "default" : "destructive"}
              onClick={handleSuspendToggle}
              disabled={acting}
            >
              {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {account.status === "suspended" ? t("reactivate") : t("suspend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission dialog */}
      <Dialog open={commissionOpen} onOpenChange={setCommissionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("commissionDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("commissionDialog.description", {
                name: account.companyName,
                default: "15%",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="commission-rate">{t("commissionDialog.rate")}</Label>
            <Input
              id="commission-rate"
              type="number"
              min={0}
              max={100}
              step={1}
              value={commissionValue}
              onChange={(e) => setCommissionValue(e.target.value)}
              placeholder={t("commissionDialog.placeholder")}
            />
            <p className="text-muted-foreground text-xs">{t("commissionDialog.hint")}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommissionOpen(false)}
              disabled={updatingCommission}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleCommissionUpdate} disabled={updatingCommission}>
              {updatingCommission && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("commissionDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
