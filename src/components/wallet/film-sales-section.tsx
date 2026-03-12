import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/pricing/format";
import { getTransactionsForFilm } from "@/lib/services/wallet-service";

interface FilmSalesSectionProps {
  accountId: string;
  filmId: string;
}

export async function FilmSalesSection({ accountId, filmId }: FilmSalesSectionProps) {
  const t = await getTranslations("wallet.filmSales");

  const { transactions, total } = await getTransactionsForFilm(accountId, filmId, {
    limit: 20,
  });

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12%]">{t("columns.date")}</TableHead>
              <TableHead className="w-[18%]">{t("columns.cinema")}</TableHead>
              <TableHead className="w-[12%]">{t("columns.orderNumber")}</TableHead>
              <TableHead className="w-[13%] text-right">{t("columns.gross")}</TableHead>
              <TableHead className="w-[13%] text-right">{t("columns.commission")}</TableHead>
              <TableHead className="w-[10%] text-right">{t("columns.ht")}</TableHead>
              <TableHead className="w-[10%] text-right">{t("columns.vat")}</TableHead>
              <TableHead className="w-[12%] text-right">{t("columns.transferred")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx, index) => (
              <TableRow key={index}>
                <TableCell>{new Date(tx.date).toLocaleDateString()}</TableCell>
                <TableCell className="truncate">{tx.cinemaName}</TableCell>
                <TableCell>{tx.orderNumber}</TableCell>
                <TableCell className="text-right">
                  {formatAmount(tx.grossAmount, tx.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(tx.commissionAmount, tx.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(tx.netAmount, tx.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(tx.taxAmount, tx.currency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatAmount(tx.netAmount + tx.taxAmount, tx.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
