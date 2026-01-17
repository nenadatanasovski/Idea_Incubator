/**
 * EnumList - Displays all enum definitions from the schema
 */

import { useState, useEffect } from "react";
import {
  Hash,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";

interface EnumDefinition {
  name: string;
  valueCount: number;
  values: string[];
}

interface EnumListProps {
  enums: string[];
  searchTerm: string;
}

export default function EnumList({ enums, searchTerm }: EnumListProps) {
  const [enumData, setEnumData] = useState<EnumDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEnums, setExpandedEnums] = useState<Set<string>>(new Set());
  const [copiedEnum, setCopiedEnum] = useState<string | null>(null);

  // Fetch all enum definitions
  useEffect(() => {
    async function fetchEnums() {
      try {
        const response = await fetch("/api/schema/enums");
        if (response.ok) {
          const json = await response.json();
          const data = json.data ?? json;
          setEnumData(data.enums || []);
          // Expand first few enums by default
          const firstFew = (data.enums || [])
            .slice(0, 3)
            .map((e: EnumDefinition) => e.name);
          setExpandedEnums(new Set(firstFew));
        }
      } catch (err) {
        console.error("Failed to fetch enums:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEnums();
  }, []);

  // Filter enums based on search
  const filteredEnums = enumData.filter(
    (e) =>
      enums.includes(e.name) ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.values.some((v) => v.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const toggleEnum = (name: string) => {
    setExpandedEnums((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const copyEnumValues = (enumDef: EnumDefinition) => {
    const typescript = `export const ${enumDef.name} = [\n  ${enumDef.values.map((v) => `"${v}"`).join(",\n  ")},\n] as const;\n\nexport type ${pascalCase(enumDef.name)} = (typeof ${enumDef.name})[number];`;
    navigator.clipboard.writeText(typescript);
    setCopiedEnum(enumDef.name);
    setTimeout(() => setCopiedEnum(null), 2000);
  };

  const pascalCase = (str: string) =>
    str
      .split(/[-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading enums...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEnums.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No enums found {searchTerm && `matching "${searchTerm}"`}
          </div>
        ) : (
          filteredEnums.map((enumDef) => (
            <div
              key={enumDef.name}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Enum Header */}
              <div
                className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleEnum(enumDef.name)}
              >
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-gray-800">
                    {enumDef.name}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                    {enumDef.valueCount}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyEnumValues(enumDef);
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="Copy as TypeScript"
                  >
                    {copiedEnum === enumDef.name ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                  {expandedEnums.has(enumDef.name) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Enum Values */}
              {expandedEnums.has(enumDef.name) && (
                <div className="p-3 space-y-1">
                  {enumDef.values.map((value, idx) => (
                    <div
                      key={value}
                      className={clsx(
                        "flex items-center gap-2 px-2 py-1 rounded text-sm",
                        searchTerm &&
                          value.toLowerCase().includes(searchTerm.toLowerCase())
                          ? "bg-yellow-50 text-yellow-800"
                          : "hover:bg-gray-50 text-gray-700",
                      )}
                    >
                      <span className="text-xs text-gray-400 w-4">{idx}</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
