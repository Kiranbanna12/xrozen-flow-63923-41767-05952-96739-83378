import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface Editor {
  id: string;
  full_name: string;
}

interface InvoiceFiltersProps {
  editors: Editor[];
  selectedEditor: string;
  onEditorChange: (value: string) => void;
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  availableMonths: string[];
}

export default function InvoiceFilters({
  editors,
  selectedEditor,
  onEditorChange,
  selectedMonth,
  onMonthChange,
  availableMonths
}: InvoiceFiltersProps) {
  return (
    <Card className="p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Editor Filter */}
        <div className="space-y-2">
          <Label>Filter by Editor</Label>
          <Select value={selectedEditor} onValueChange={onEditorChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Editors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Editors</SelectItem>
              {editors.map(editor => (
                <SelectItem key={editor.id} value={editor.id}>
                  {editor.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Filter */}
        <div className="space-y-2">
          <Label>Filter by Month</Label>
          <Select value={selectedMonth} onValueChange={onMonthChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {availableMonths.map(month => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
