import { Badge } from "@/components/ui/badge";

type Category = "Excellent" | "Good" | "Normal" | "Bad" | "Terrible" | "No Category";

const styles: Record<Category, string> = {
  "Excellent": "bg-green-500/15 text-green-700 border-green-500/20 hover:bg-green-500/25 dark:bg-green-500/20 dark:text-green-400",
  "Good": "bg-blue-500/15 text-blue-700 border-blue-500/20 hover:bg-blue-500/25 dark:bg-blue-500/20 dark:text-blue-400",
  "Normal": "bg-slate-500/15 text-slate-700 border-slate-500/20 hover:bg-slate-500/25 dark:bg-slate-500/20 dark:text-slate-400",
  "Bad": "bg-orange-500/15 text-orange-700 border-orange-500/20 hover:bg-orange-500/25 dark:bg-orange-500/20 dark:text-orange-400",
  "Terrible": "bg-red-500/15 text-red-700 border-red-500/20 hover:bg-red-500/25 dark:bg-red-500/20 dark:text-red-400",
  "No Category": "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
};

export function CategoryBadge({ category }: { category: string }) {
  const normalizedCategory = (category in styles ? category : "No Category") as Category;
  
  return (
    <Badge variant="outline" className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${styles[normalizedCategory]}`}>
      {normalizedCategory}
    </Badge>
  );
}
