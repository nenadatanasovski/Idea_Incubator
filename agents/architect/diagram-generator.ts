/**
 * Component Diagram Generator
 *
 * Generates visual architecture diagrams in Mermaid.js and PlantUML formats.
 * Supports C4 model levels (Context, Container, Component) and auto-detects
 * components from ArchitectureDoc specifications.
 */

import {
  ArchitectureDoc,
  ComponentSpec,
} from "./types.js";

/** C4 model abstraction levels */
export type C4Level = "context" | "container" | "component";

/** Supported output formats */
export type DiagramFormat = "mermaid" | "plantuml";

/** Options for diagram generation */
export interface DiagramOptions {
  /** C4 model level to render */
  level: C4Level;
  /** Output format */
  format: DiagramFormat;
  /** Diagram title (defaults to project name) */
  title?: string;
  /** Whether to include a legend */
  includeLegend?: boolean;
  /** Direction of the diagram layout */
  direction?: "TB" | "BT" | "LR" | "RL";
}

/** Result of diagram generation */
export interface DiagramResult {
  /** The generated diagram source code */
  content: string;
  /** The output format used */
  format: DiagramFormat;
  /** The C4 level rendered */
  level: C4Level;
  /** Suggested file extension */
  fileExtension: string;
}

/** Internal edge between two nodes */
interface DiagramEdge {
  from: string;
  to: string;
  label: string;
  style?: string;
}

/**
 * ComponentDiagramGenerator - generates architecture diagrams from specs.
 *
 * Reads an ArchitectureDoc and produces Mermaid.js (.mmd) or PlantUML (.puml)
 * diagram source representing system structure at different C4 levels.
 */
export class ComponentDiagramGenerator {
  private architecture: ArchitectureDoc;

  constructor(architecture: ArchitectureDoc) {
    this.architecture = architecture;
  }

  /**
   * Main entry point - generate a diagram for the given options.
   */
  generate(options: DiagramOptions): DiagramResult {
    const title = options.title ?? this.architecture.projectName;
    const includeLegend = options.includeLegend ?? true;
    const direction = options.direction ?? "TB";

    let content: string;

    if (options.format === "mermaid") {
      content = this.generateMermaid(options.level, title, includeLegend, direction);
    } else {
      content = this.generatePlantUML(options.level, title, includeLegend);
    }

    return {
      content,
      format: options.format,
      level: options.level,
      fileExtension: options.format === "mermaid" ? ".mmd" : ".puml",
    };
  }

  // ---------------------------------------------------------------------------
  // Mermaid.js generation
  // ---------------------------------------------------------------------------

  private generateMermaid(
    level: C4Level,
    title: string,
    includeLegend: boolean,
    direction: string
  ): string {
    const lines: string[] = [];

    switch (level) {
      case "context":
        this.mermaidContextDiagram(lines, title, direction);
        break;
      case "container":
        this.mermaidContainerDiagram(lines, title, direction);
        break;
      case "component":
        this.mermaidComponentDiagram(lines, title, direction);
        break;
    }

    if (includeLegend) {
      lines.push("");
      this.mermaidLegend(lines, level);
    }

    return lines.join("\n");
  }

  /** C4 Context level - system and external actors */
  private mermaidContextDiagram(lines: string[], title: string, direction: string): void {
    lines.push(`%% C4 Context Diagram: ${title}`);
    lines.push(`graph ${direction}`);

    // System boundary
    const systemId = this.sanitizeId(title);
    lines.push(`  ${systemId}["${title}"]:::system`);

    // External actors derived from component interfaces
    const externalActors = this.detectExternalActors();
    for (const actor of externalActors) {
      const actorId = this.sanitizeId(actor.name);
      lines.push(`  ${actorId}(["${actor.name}"]):::person`);
      lines.push(`  ${actorId} -->|"${actor.label}"| ${systemId}`);
    }

    // External systems inferred from infrastructure dependencies
    const externalSystems = this.detectExternalSystems();
    for (const ext of externalSystems) {
      const extId = this.sanitizeId(ext.name);
      lines.push(`  ${extId}[/"${ext.name}"/]:::external`);
      lines.push(`  ${systemId} -->|"${ext.label}"| ${extId}`);
    }

    // Styles
    lines.push("");
    lines.push("  classDef system fill:#1168bd,stroke:#0b4884,color:#fff");
    lines.push("  classDef person fill:#08427b,stroke:#052e56,color:#fff");
    lines.push("  classDef external fill:#999,stroke:#666,color:#fff");
  }

  /** C4 Container level - deployable units inside the system */
  private mermaidContainerDiagram(lines: string[], title: string, direction: string): void {
    lines.push(`%% C4 Container Diagram: ${title}`);
    lines.push(`graph ${direction}`);
    lines.push(`  subgraph boundary["${title}"]`);

    const components = this.architecture.components;
    const containerGroups = this.groupByType(components);

    for (const [type, comps] of Object.entries(containerGroups)) {
      lines.push(`    subgraph ${type}["${this.typeLabel(type)}"]`);
      for (const comp of comps) {
        const id = this.sanitizeId(comp.id);
        const tech = comp.technology ? `\\n[${comp.technology}]` : "";
        lines.push(`      ${id}["${comp.name}${tech}"]:::${type}`);
      }
      lines.push("    end");
    }

    lines.push("  end");

    // Edges from dependencies
    const edges = this.buildEdges(components);
    for (const edge of edges) {
      lines.push(`  ${edge.from} -->|"${edge.label}"| ${edge.to}`);
    }

    // Styles
    lines.push("");
    lines.push("  classDef frontend fill:#438dd5,stroke:#2e6295,color:#fff");
    lines.push("  classDef backend fill:#1168bd,stroke:#0b4884,color:#fff");
    lines.push("  classDef database fill:#2b7a0b,stroke:#1a5a06,color:#fff");
    lines.push("  classDef service fill:#a259ff,stroke:#7b3fcc,color:#fff");
    lines.push("  classDef library fill:#666,stroke:#444,color:#fff");
    lines.push("  classDef infrastructure fill:#e07000,stroke:#a85300,color:#fff");
  }

  /** C4 Component level - internal structure of each container */
  private mermaidComponentDiagram(lines: string[], title: string, direction: string): void {
    lines.push(`%% C4 Component Diagram: ${title}`);
    lines.push(`graph ${direction}`);

    const components = this.architecture.components;

    for (const comp of components) {
      const compId = this.sanitizeId(comp.id);
      lines.push(`  subgraph ${compId}_group["${comp.name}"]`);

      // Each responsibility becomes a sub-component
      comp.responsibilities.forEach((resp, i) => {
        const subId = `${compId}_r${i}`;
        lines.push(`    ${subId}["${resp}"]:::${comp.type}`);
      });

      // Interfaces as ports
      for (const iface of comp.interfaces) {
        const ifId = `${compId}_if_${this.sanitizeId(iface.name)}`;
        const arrow = iface.direction === "inbound" ? ">" : "<";
        lines.push(`    ${ifId}([${arrow} ${iface.name}]):::iface`);
      }

      lines.push("  end");
    }

    // Edges from dependencies and interfaces
    const edges = this.buildEdges(components);
    for (const edge of edges) {
      lines.push(`  ${edge.from} -->|"${edge.label}"| ${edge.to}`);
    }

    // Relationship edges from database schema if available
    if (this.architecture.databaseSchema.relationships) {
      for (const rel of this.architecture.databaseSchema.relationships) {
        const fromId = this.sanitizeId(rel.from);
        const toId = this.sanitizeId(rel.to);
        lines.push(`  ${fromId} -.->|"${rel.type}"| ${toId}`);
      }
    }

    // Styles
    lines.push("");
    lines.push("  classDef frontend fill:#438dd5,stroke:#2e6295,color:#fff");
    lines.push("  classDef backend fill:#1168bd,stroke:#0b4884,color:#fff");
    lines.push("  classDef database fill:#2b7a0b,stroke:#1a5a06,color:#fff");
    lines.push("  classDef service fill:#a259ff,stroke:#7b3fcc,color:#fff");
    lines.push("  classDef library fill:#666,stroke:#444,color:#fff");
    lines.push("  classDef infrastructure fill:#e07000,stroke:#a85300,color:#fff");
    lines.push("  classDef iface fill:#fff,stroke:#333,color:#333");
  }

  /** Append a Mermaid-compatible legend as a comment block */
  private mermaidLegend(lines: string[], level: C4Level): void {
    lines.push("%% Legend");
    switch (level) {
      case "context":
        lines.push("%% [Rounded box] = Person / Actor");
        lines.push("%% [Rectangle]   = System");
        lines.push("%% [Trapezoid]   = External System");
        lines.push("%% Solid arrow   = Interaction / Data flow");
        break;
      case "container":
        lines.push("%% Blue     = Frontend container");
        lines.push("%% Dark blue = Backend container");
        lines.push("%% Green    = Database container");
        lines.push("%% Purple   = Service container");
        lines.push("%% Grey     = Library");
        lines.push("%% Orange   = Infrastructure");
        lines.push("%% Solid arrow = Dependency / Data flow");
        break;
      case "component":
        lines.push("%% Subgraph          = Container boundary");
        lines.push("%% Rectangle         = Responsibility / sub-component");
        lines.push("%% Rounded rectangle = Interface port");
        lines.push("%% Solid arrow       = Dependency");
        lines.push("%% Dashed arrow      = Data relationship");
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // PlantUML generation
  // ---------------------------------------------------------------------------

  private generatePlantUML(
    level: C4Level,
    title: string,
    includeLegend: boolean
  ): string {
    const lines: string[] = [];

    lines.push("@startuml");
    lines.push(`title ${title} - C4 ${this.c4LevelLabel(level)} Diagram`);
    lines.push("");

    switch (level) {
      case "context":
        this.plantumlContextDiagram(lines, title);
        break;
      case "container":
        this.plantumlContainerDiagram(lines, title);
        break;
      case "component":
        this.plantumlComponentDiagram(lines, title);
        break;
    }

    if (includeLegend) {
      lines.push("");
      this.plantumlLegend(lines, level);
    }

    lines.push("");
    lines.push("@enduml");

    return lines.join("\n");
  }

  /** PlantUML C4 Context diagram */
  private plantumlContextDiagram(lines: string[], title: string): void {
    lines.push("skinparam rectangle {");
    lines.push("  BackgroundColor<<system>> #1168BD");
    lines.push("  FontColor<<system>> #FFFFFF");
    lines.push("  BackgroundColor<<external>> #999999");
    lines.push("  FontColor<<external>> #FFFFFF");
    lines.push("}");
    lines.push("");

    const systemId = this.sanitizeId(title);
    lines.push(`rectangle "${title}" as ${systemId} <<system>>`);

    const externalActors = this.detectExternalActors();
    for (const actor of externalActors) {
      const actorId = this.sanitizeId(actor.name);
      lines.push(`actor "${actor.name}" as ${actorId}`);
      lines.push(`${actorId} --> ${systemId} : ${actor.label}`);
    }

    const externalSystems = this.detectExternalSystems();
    for (const ext of externalSystems) {
      const extId = this.sanitizeId(ext.name);
      lines.push(`rectangle "${ext.name}" as ${extId} <<external>>`);
      lines.push(`${systemId} --> ${extId} : ${ext.label}`);
    }
  }

  /** PlantUML C4 Container diagram */
  private plantumlContainerDiagram(lines: string[], title: string): void {
    lines.push("skinparam component {");
    lines.push("  BackgroundColor<<frontend>> #438DD5");
    lines.push("  FontColor<<frontend>> #FFFFFF");
    lines.push("  BackgroundColor<<backend>> #1168BD");
    lines.push("  FontColor<<backend>> #FFFFFF");
    lines.push("  BackgroundColor<<database>> #2B7A0B");
    lines.push("  FontColor<<database>> #FFFFFF");
    lines.push("  BackgroundColor<<service>> #A259FF");
    lines.push("  FontColor<<service>> #FFFFFF");
    lines.push("  BackgroundColor<<library>> #666666");
    lines.push("  FontColor<<library>> #FFFFFF");
    lines.push("  BackgroundColor<<infrastructure>> #E07000");
    lines.push("  FontColor<<infrastructure>> #FFFFFF");
    lines.push("}");
    lines.push("");

    lines.push(`package "${title}" {`);

    const components = this.architecture.components;
    for (const comp of components) {
      const id = this.sanitizeId(comp.id);
      const tech = comp.technology ? `\\n[${comp.technology}]` : "";
      lines.push(`  component "${comp.name}${tech}" as ${id} <<${comp.type}>>`);
    }

    lines.push("}");
    lines.push("");

    const edges = this.buildEdges(components);
    for (const edge of edges) {
      lines.push(`${edge.from} --> ${edge.to} : ${edge.label}`);
    }
  }

  /** PlantUML C4 Component diagram */
  private plantumlComponentDiagram(lines: string[], title: string): void {
    lines.push("skinparam component {");
    lines.push("  BackgroundColor #1168BD");
    lines.push("  FontColor #FFFFFF");
    lines.push("}");
    lines.push("skinparam interface {");
    lines.push("  BackgroundColor #FFFFFF");
    lines.push("}");
    lines.push("");

    const components = this.architecture.components;

    for (const comp of components) {
      const compId = this.sanitizeId(comp.id);
      lines.push(`package "${comp.name}" as ${compId}_pkg {`);

      comp.responsibilities.forEach((resp, i) => {
        const subId = `${compId}_r${i}`;
        lines.push(`  component "${resp}" as ${subId}`);
      });

      for (const iface of comp.interfaces) {
        const ifId = `${compId}_if_${this.sanitizeId(iface.name)}`;
        if (iface.direction === "inbound") {
          lines.push(`  interface "${iface.name}" as ${ifId}`);
        } else {
          lines.push(`  portin "${iface.name}" as ${ifId}`);
        }
      }

      lines.push("}");
      lines.push("");
    }

    const edges = this.buildEdges(components);
    for (const edge of edges) {
      lines.push(`${edge.from} --> ${edge.to} : ${edge.label}`);
    }

    if (this.architecture.databaseSchema.relationships) {
      for (const rel of this.architecture.databaseSchema.relationships) {
        const fromId = this.sanitizeId(rel.from);
        const toId = this.sanitizeId(rel.to);
        lines.push(`${fromId} ..> ${toId} : ${rel.type}`);
      }
    }
  }

  /** PlantUML legend block */
  private plantumlLegend(lines: string[], level: C4Level): void {
    lines.push("legend right");
    switch (level) {
      case "context":
        lines.push("  |= Symbol |= Meaning |");
        lines.push("  | <back:#1168BD><color:#FFF> Rectangle </color></back> | System |");
        lines.push("  | <back:#999><color:#FFF> Rectangle </color></back> | External System |");
        lines.push("  | Actor icon | Person / User |");
        lines.push("  | Solid arrow | Interaction |");
        break;
      case "container":
        lines.push("  |= Color |= Type |");
        lines.push("  | <back:#438DD5><color:#FFF> Blue </color></back> | Frontend |");
        lines.push("  | <back:#1168BD><color:#FFF> Dark Blue </color></back> | Backend |");
        lines.push("  | <back:#2B7A0B><color:#FFF> Green </color></back> | Database |");
        lines.push("  | <back:#A259FF><color:#FFF> Purple </color></back> | Service |");
        lines.push("  | <back:#666><color:#FFF> Grey </color></back> | Library |");
        lines.push("  | <back:#E07000><color:#FFF> Orange </color></back> | Infrastructure |");
        break;
      case "component":
        lines.push("  |= Symbol |= Meaning |");
        lines.push("  | Package | Container boundary |");
        lines.push("  | Component | Sub-component / Responsibility |");
        lines.push("  | Interface | Port / API surface |");
        lines.push("  | Solid arrow | Dependency |");
        lines.push("  | Dashed arrow | Data relationship |");
        break;
    }
    lines.push("endlegend");
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Build edges from component dependency declarations */
  private buildEdges(components: ComponentSpec[]): DiagramEdge[] {
    const edges: DiagramEdge[] = [];
    const idMap = new Map(components.map(c => [c.name.toLowerCase(), c.id]));

    for (const comp of components) {
      for (const dep of comp.dependencies) {
        const targetId = idMap.get(dep.toLowerCase());
        if (targetId) {
          edges.push({
            from: this.sanitizeId(comp.id),
            to: this.sanitizeId(targetId),
            label: "uses",
          });
        }
      }

      for (const iface of comp.interfaces) {
        if (iface.direction === "outbound") {
          // Find target component by interface contract or name
          const target = components.find(c =>
            c.interfaces.some(
              ci => ci.name === iface.name && ci.direction === "inbound"
            )
          );
          if (target && target.id !== comp.id) {
            edges.push({
              from: this.sanitizeId(comp.id),
              to: this.sanitizeId(target.id),
              label: `${iface.type}: ${iface.name}`,
            });
          }
        }
      }
    }

    return this.deduplicateEdges(edges);
  }

  /** Detect external actors from component interfaces */
  private detectExternalActors(): Array<{ name: string; label: string }> {
    const actors: Array<{ name: string; label: string }> = [];
    const seen = new Set<string>();

    for (const comp of this.architecture.components) {
      if (comp.type === "frontend") {
        const name = "User";
        if (!seen.has(name)) {
          seen.add(name);
          actors.push({ name, label: `Uses ${comp.name}` });
        }
      }
    }

    // Check API contracts for external consumers
    for (const api of this.architecture.apiContracts) {
      if (api.authentication) {
        const name = "Authenticated Client";
        if (!seen.has(name)) {
          seen.add(name);
          actors.push({ name, label: `Calls ${api.name}` });
        }
      }
    }

    // If no actors detected, add a generic one
    if (actors.length === 0) {
      actors.push({ name: "User", label: "Interacts with system" });
    }

    return actors;
  }

  /** Detect external system dependencies */
  private detectExternalSystems(): Array<{ name: string; label: string }> {
    const systems: Array<{ name: string; label: string }> = [];
    const seen = new Set<string>();

    for (const comp of this.architecture.components) {
      if (comp.type === "database") {
        const name = `${comp.technology || "Database"} Store`;
        if (!seen.has(name)) {
          seen.add(name);
          systems.push({ name, label: "Reads/Writes data" });
        }
      }
      if (comp.type === "infrastructure") {
        if (!seen.has(comp.name)) {
          seen.add(comp.name);
          systems.push({ name: comp.name, label: "Infrastructure" });
        }
      }
    }

    return systems;
  }

  /** Group components by type for subgraph nesting */
  private groupByType(components: ComponentSpec[]): Record<string, ComponentSpec[]> {
    const groups: Record<string, ComponentSpec[]> = {};
    for (const comp of components) {
      if (!groups[comp.type]) groups[comp.type] = [];
      groups[comp.type].push(comp);
    }
    return groups;
  }

  /** Human-readable label for a component type */
  private typeLabel(type: string): string {
    const labels: Record<string, string> = {
      frontend: "Frontend",
      backend: "Backend Services",
      database: "Data Stores",
      service: "Microservices",
      library: "Libraries",
      infrastructure: "Infrastructure",
    };
    return labels[type] || type;
  }

  /** Human-readable label for a C4 level */
  private c4LevelLabel(level: C4Level): string {
    const labels: Record<C4Level, string> = {
      context: "Context",
      container: "Container",
      component: "Component",
    };
    return labels[level];
  }

  /** Sanitize a string into a valid diagram node ID */
  private sanitizeId(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "")
      || "node";
  }

  /** Remove duplicate edges (same from+to) */
  private deduplicateEdges(edges: DiagramEdge[]): DiagramEdge[] {
    const seen = new Set<string>();
    return edges.filter(e => {
      const key = `${e.from}->${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
