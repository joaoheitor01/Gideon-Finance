import { useMemo, useState } from "react";
import { Transaction } from "@/hooks/useTransactions";
import { formatCurrency, formatDate, MONTHS } from "@/lib/formatters";
import { Trash2, X, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TransactionListProps {
  transactions: Transaction[];
  selectedMonth: number | null;
  selectedYear: number;
  onDelete: (id: string) => Promise<{ error: Error | null }>;
  onClearFilter: () => void;
}

export function TransactionList({
  transactions,
  selectedMonth,
  selectedYear,
  onDelete,
  onClearFilter,
}: TransactionListProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTransactions = useMemo(() => {
    if (selectedMonth === null) return [];
    
    return transactions.filter((t) => {
      const date = new Date(t.date + "T00:00:00");
      return (
        date.getMonth() === selectedMonth &&
        date.getFullYear() === selectedYear
      );
    });
  }, [transactions, selectedMonth, selectedYear]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    await onDelete(id);
    setIsDeleting(false);
  };

  if (selectedMonth === null) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center animate-fade-in">
        <p className="text-muted-foreground">
          Selecione um mês no resumo para ver as transações
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card animate-fade-in">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="font-semibold text-foreground">
          Extrato de {MONTHS[selectedMonth]}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClearFilter}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 rounded-full bg-secondary p-4">
            <Inbox className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Nenhuma transação encontrada
          </h3>
          <p className="mt-1 text-muted-foreground">
            Que tal registrar sua primeira transação?
          </p>
          <Button className="mt-4 gap-2" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Plus className="h-4 w-4" />
            Adicionar Transação
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-sm text-muted-foreground">
                <th className="p-4 font-medium">Descrição</th>
                <th className="p-4 font-medium text-right">Valor</th>
                <th className="p-4 font-medium text-right">Data</th>
                <th className="p-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-foreground">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.category}
                      </p>
                    </div>
                  </td>
                  <td className={`p-4 text-right font-medium ${
                    transaction.type === "entrada" ? "text-primary" : "text-destructive"
                  }`}>
                    {transaction.type === "saida" && "-"}
                    {formatCurrency(Number(transaction.amount))}
                  </td>
                  <td className="p-4 text-right text-muted-foreground">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="p-4 text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita. Isso irá deletar permanentemente sua transação.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(transaction.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isDeleting ? "Deletando..." : "Deletar"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
