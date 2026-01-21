import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TransactionInput } from "@/hooks/useTransactions";
import { CATEGORIES } from "@/lib/formatters";
import { Plus } from "lucide-react";

interface TransactionFormProps {
  onSubmit: (input: TransactionInput) => Promise<{ error: Error | null }>;
}

export function TransactionForm({ onSubmit }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState(CATEGORIES);
  const [newCategory, setNewCategory] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Alimentação",
    date: new Date().toISOString().split("T")[0],
    isIncome: false,
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, "");

    if (numericValue === "") {
      setFormData((prev) => ({ ...prev, amount: "" }));
      return;
    }

    const numberValue = parseFloat(numericValue) / 100;
    const formattedValue = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
    }).format(numberValue);

    setFormData((prev) => ({ ...prev, amount: formattedValue }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    setLoading(true);
    const amount = parseFloat(formData.amount.replace(/\./g, "").replace(",", "."));
    
    const { error } = await onSubmit({
      type: formData.isIncome ? "entrada" : "saida",
      description: formData.description,
      amount: amount,
      category: formData.category,
      date: formData.date,
    });

    if (!error) {
      setFormData({
        description: "",
        amount: "",
        category: "Alimentação",
        date: new Date().toISOString().split("T")[0],
        isIncome: false,
      });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6">
      <div className="grid gap-4 md:grid-cols-7 md:items-end">
        <div className="md:col-span-2">
          <Label htmlFor="description" className="text-muted-foreground">
            Descrição
          </Label>
          <Input
            id="description"
            placeholder="Ex: Almoço, Salário..."
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            className="mt-1.5 bg-secondary border-0"
          />
        </div>

        <div>
          <Label htmlFor="amount" className="text-muted-foreground">
            Valor
          </Label>
          <Input
            id="amount"
            type="text"
            placeholder="0,00"
            value={formData.amount}
            onChange={handleAmountChange}
            className="mt-1.5 bg-secondary border-0"
          />
        </div>

        <div>
          <Label htmlFor="date" className="text-muted-foreground">
            Data
          </Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, date: e.target.value }))
            }
            className="mt-1.5 bg-secondary border-0"
          />
        </div>

        <div>
          <Label htmlFor="category" className="text-muted-foreground">
            Categoria
          </Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value }))
              }
            >
              <SelectTrigger className="bg-secondary border-0 w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60">
                <div className="space-y-2">
                  <p className="font-medium">Nova Categoria</p>
                  <Input
                    placeholder="Ex: Contas"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      if (newCategory && !categories.includes(newCategory)) {
                        const updatedCategories = [...categories, newCategory];
                        setCategories(updatedCategories);
                        setFormData((prev) => ({
                          ...prev,
                          category: newCategory,
                        }));
                        setNewCategory("");
                        setPopoverOpen(false);
                      }
                    }}
                    className="w-full"
                  >
                    Adicionar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <div className="flex items-center gap-3 justify-center">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${!formData.isIncome ? "text-primary" : "text-muted-foreground"}`}>
              Saída
            </span>
            <Switch
              checked={formData.isIncome}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isIncome: checked }))
              }
            />
            <span className={`text-sm ${formData.isIncome ? "text-primary" : "text-muted-foreground"}`}>
              Entrada
            </span>
          </div>
        </div>

        <div className="md:col-span-2">
          <Button type="submit" disabled={loading} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>
    </form>
  );
}
