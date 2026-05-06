import type { ReactNode } from "react";

import {
  Clipboard,
  Copy,
  CopyPlus,
  Edit3,
  Eraser,
  ExternalLink,
  Eye,
  FilePlus,
  FolderPlus,
  FolderTree,
  Info,
  Pencil,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Shield,
  Sliders,
  Sparkles,
  Star,
  Tags,
  Terminal,
  Trash2,
  Undo2,
} from "@/components/AppIcons";

import type { ExplorerCommandDefinition } from "../../config/explorerContextMenu";

export function renderExplorerCommandLibraryIcon(
  iconName?: string,
  size = 13,
): ReactNode {
  if (iconName?.startsWith("data:image/")) {
    return (
      <img
        src={iconName}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  switch (iconName) {
    case "Clipboard":
      return <Clipboard size={size} />;
    case "Copy":
      return <Copy size={size} />;
    case "CopyPlus":
      return <CopyPlus size={size} />;
    case "Edit3":
      return <Edit3 size={size} />;
    case "Eraser":
      return <Eraser size={size} />;
    case "ExternalLink":
      return <ExternalLink size={size} />;
    case "Eye":
      return <Eye size={size} />;
    case "FilePlus":
      return <FilePlus size={size} />;
    case "FolderPlus":
      return <FolderPlus size={size} />;
    case "FolderTree":
      return <FolderTree size={size} />;
    case "Info":
      return <Info size={size} />;
    case "Pencil":
      return <Pencil size={size} />;
    case "RefreshCw":
      return <RefreshCw size={size} />;
    case "RotateCcw":
      return <RotateCcw size={size} />;
    case "Save":
      return <Save size={size} />;
    case "Scissors":
      return <Scissors size={size} />;
    case "Shield":
      return <Shield size={size} />;
    case "Sliders":
      return <Sliders size={size} />;
    case "Sparkles":
      return <Sparkles size={size} />;
    case "Star":
      return <Star size={size} />;
    case "Tags":
      return <Tags size={size} />;
    case "Terminal":
      return <Terminal size={size} />;
    case "Trash2":
      return <Trash2 size={size} />;
    case "Undo2":
      return <Undo2 size={size} />;
    default:
      return <Puzzle size={size} />;
  }
}

export function resolveExplorerCommandSourceLabel(
  command: ExplorerCommandDefinition,
): string {
  if (command.source === "action") {
    return `Action · ${command.packName}`;
  }
  if (command.source === "plugin") {
    return `Plugin · ${command.pluginName}`;
  }
  if (command.source === "preview") {
    return "Preview Lane";
  }
  return "Built-In";
}

export function buildExplorerCommandSearchHaystack(
  command: ExplorerCommandDefinition,
): string {
  return [
    command.title,
    command.description ?? "",
    command.id,
    command.group,
    command.source,
    command.shortcutId ?? "",
    resolveExplorerCommandSourceLabel(command),
    command.source === "action" ? command.packName : "",
    command.source === "plugin" ? command.pluginName : "",
  ]
    .join(" ")
    .toLowerCase();
}
