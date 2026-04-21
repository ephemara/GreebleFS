import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';

import {
  createPanelIconSlotId,
  getBuiltInIconTheme,
  normalizeIconId,
  resolveIconSrc,
  resolvePanelIconReference,
  resolveUiIconReference,
  type OverlayResolvedIconTheme,
} from '../config/iconTheme';

const IconThemeContext = createContext<OverlayResolvedIconTheme>(getBuiltInIconTheme());
const lucideIconLookup = LucideIcons as unknown as Record<string, LucideIcon | undefined>;

function resolveIconDimension(size: LucideProps['size']): string | number {
  if (typeof size === 'number' || typeof size === 'string') {
    return size;
  }

  return 24;
}

function renderIconImage(iconSrc: string, props: LucideProps): ReactNode {
  const dimension = resolveIconDimension(props.size);
  const imageStyle: CSSProperties = {
    width: dimension,
    height: dimension,
    minWidth: dimension,
    minHeight: dimension,
    objectFit: 'contain',
    display: 'inline-block',
    flexShrink: 0,
    verticalAlign: 'middle',
    pointerEvents: 'none',
    ...props.style,
  };

  return (
    <img
      src={iconSrc}
      alt=""
      aria-hidden={props['aria-label'] ? undefined : true}
      aria-label={props['aria-label']}
      className={props.className}
      style={imageStyle}
      draggable={false}
    />
  );
}

function renderResolvedIconReference(
  iconReference: string | undefined,
  iconTheme: OverlayResolvedIconTheme,
  props: LucideProps,
): ReactNode | null {
  if (!iconReference) {
    return null;
  }

  if (iconReference.startsWith('lucide:')) {
    const overrideIconName = iconReference.slice('lucide:'.length).trim();
    const OverrideIcon = lucideIconLookup[overrideIconName];
    if (OverrideIcon) {
      return <OverrideIcon {...props} />;
    }
    return null;
  }

  const iconSrc = resolveIconSrc(iconReference, iconTheme);
  return iconSrc ? renderIconImage(iconSrc, props) : null;
}

function createThemedIcon(slotId: string, FallbackIcon: LucideIcon): LucideIcon {
  const normalizedSlotId = normalizeIconId(slotId);

  return function ThemedIcon(props: LucideProps) {
    const iconTheme = useContext(IconThemeContext);
    const themedIcon = renderResolvedIconReference(
      resolveUiIconReference(normalizedSlotId, iconTheme),
      iconTheme,
      props,
    );
    if (themedIcon) {
      return themedIcon;
    }

    return <FallbackIcon {...props} />;
  } as LucideIcon;
}

export function ThemedPanelIcon({
  panelId,
  fallbackIcon: FallbackIcon,
  fallbackSlotId,
  ...props
}: LucideProps & {
  panelId: string;
  fallbackIcon: LucideIcon;
  fallbackSlotId?: string;
}) {
  const iconTheme = useContext(IconThemeContext);
  const panelIcon = renderResolvedIconReference(
    resolvePanelIconReference(panelId, iconTheme),
    iconTheme,
    props,
  );
  if (panelIcon) {
    return panelIcon;
  }

  const fallbackThemedIcon = fallbackSlotId
    ? renderResolvedIconReference(resolveUiIconReference(fallbackSlotId, iconTheme), iconTheme, props)
    : null;
  if (fallbackThemedIcon) {
    return fallbackThemedIcon;
  }

  return <FallbackIcon {...props} />;
}

export function getPanelIconSlotId(panelId: string): string {
  return createPanelIconSlotId(panelId);
}

export function IconThemeProvider({
  iconTheme,
  children,
}: {
  iconTheme?: OverlayResolvedIconTheme | null;
  children: ReactNode;
}) {
  return (
    <IconThemeContext.Provider value={iconTheme ?? getBuiltInIconTheme()}>
      {children}
    </IconThemeContext.Provider>
  );
}

export function useActiveIconTheme(): OverlayResolvedIconTheme {
  return useContext(IconThemeContext);
}

export type { LucideProps } from 'lucide-react';

export const AlertCircle = createThemedIcon('alert_circle', LucideIcons.AlertCircle);
export const AlertTriangle = createThemedIcon('alert_triangle', LucideIcons.AlertTriangle);
export const ArrowDown = createThemedIcon('arrow_down', LucideIcons.ArrowDown);
export const ArrowDownToLine = createThemedIcon('arrow_down_to_line', LucideIcons.ArrowDownToLine);
export const ArrowLeft = createThemedIcon('arrow_left', LucideIcons.ArrowLeft);
export const ArrowRight = createThemedIcon('arrow_right', LucideIcons.ArrowRight);
export const ArrowUp = createThemedIcon('arrow_up', LucideIcons.ArrowUp);
export const ArrowUpDown = createThemedIcon('arrow_up_down', LucideIcons.ArrowUpDown);
export const ArrowUpLeft = createThemedIcon('arrow_up_left', LucideIcons.ArrowUpLeft);
export const ArrowUpRight = createThemedIcon('arrow_up_right', LucideIcons.ArrowUpRight);
export const AudioLines = createThemedIcon('audio_lines', LucideIcons.AudioLines);
export const AudioWaveform = createThemedIcon('audio_waveform', LucideIcons.AudioWaveform);
export const Blocks = createThemedIcon('blocks', LucideIcons.Blocks);
export const Bot = createThemedIcon('bot', LucideIcons.Bot);
export const Bug = createThemedIcon('bug', LucideIcons.Bug);
export const Camera = createThemedIcon('camera', LucideIcons.Camera);
export const Check = createThemedIcon('check', LucideIcons.Check);
export const ChevronDown = createThemedIcon('chevron_down', LucideIcons.ChevronDown);
export const ChevronLeft = createThemedIcon('chevron_left', LucideIcons.ChevronLeft);
export const ChevronRight = createThemedIcon('chevron_right', LucideIcons.ChevronRight);
export const ChevronUp = createThemedIcon('chevron_up', LucideIcons.ChevronUp);
export const Circle = createThemedIcon('circle', LucideIcons.Circle);
export const Clapperboard = createThemedIcon('clapperboard', LucideIcons.Clapperboard);
export const Clipboard = createThemedIcon('clipboard', LucideIcons.Clipboard);
export const Clock = createThemedIcon('clock', LucideIcons.Clock);
export const Copy = createThemedIcon('copy', LucideIcons.Copy);
export const CopyPlus = createThemedIcon('copy_plus', LucideIcons.CopyPlus);
export const CornerDownLeft = createThemedIcon('corner_down_left', LucideIcons.CornerDownLeft);
export const Cpu = createThemedIcon('cpu', LucideIcons.Cpu);
export const Crop = createThemedIcon('crop', LucideIcons.Crop);
export const Crosshair = createThemedIcon('crosshair', LucideIcons.Crosshair);
export const Database = createThemedIcon('database', LucideIcons.Database);
export const Download = createThemedIcon('download', LucideIcons.Download);
export const Droplet = createThemedIcon('droplet', LucideIcons.Droplet);
export const Edit3 = createThemedIcon('edit3', LucideIcons.Edit3);
export const Eraser = createThemedIcon('eraser', LucideIcons.Eraser);
export const ExternalLink = createThemedIcon('external_link', LucideIcons.ExternalLink);
export const Eye = createThemedIcon('eye', LucideIcons.Eye);
export const File = createThemedIcon('file', LucideIcons.File);
export const FilePlus = createThemedIcon('file_plus', LucideIcons.FilePlus);
export const FileSearch = createThemedIcon('file_search', LucideIcons.FileSearch);
export const FileText = createThemedIcon('file_text', LucideIcons.FileText);
export const Film = createThemedIcon('film', LucideIcons.Film);
export const Folder = createThemedIcon('folder', LucideIcons.Folder);
export const FolderArchive = createThemedIcon('folder_archive', LucideIcons.FolderArchive);
export const FolderGit2 = createThemedIcon('folder_git2', LucideIcons.FolderGit2);
export const FolderOpen = createThemedIcon('folder_open', LucideIcons.FolderOpen);
export const FolderPlus = createThemedIcon('folder_plus', LucideIcons.FolderPlus);
export const FolderTree = createThemedIcon('folder_tree', LucideIcons.FolderTree);
export const GitBranch = createThemedIcon('git_branch', LucideIcons.GitBranch);
export const GitCommit = createThemedIcon('git_commit', LucideIcons.GitCommit);
export const HardDrive = createThemedIcon('hard_drive', LucideIcons.HardDrive);
export const HardDriveDownload = createThemedIcon('hard_drive_download', LucideIcons.HardDriveDownload);
export const Hash = createThemedIcon('hash', LucideIcons.Hash);
export const Highlighter = createThemedIcon('highlighter', LucideIcons.Highlighter);
export const Home = createThemedIcon('home', LucideIcons.Home);
export const Image = createThemedIcon('image', LucideIcons.Image);
export const ImageIcon = createThemedIcon('image_icon', LucideIcons.ImageIcon);
export const Info = createThemedIcon('info', LucideIcons.Info);
export const Layers3 = createThemedIcon('layers3', LucideIcons.Layers3);
export const LayoutGrid = createThemedIcon('layout_grid', LucideIcons.LayoutGrid);
export const List = createThemedIcon('list', LucideIcons.List);
export const ListTodo = createThemedIcon('list_todo', LucideIcons.ListTodo);
export const Loader = createThemedIcon('loader', LucideIcons.Loader);
export const Loader2 = createThemedIcon('loader2', LucideIcons.Loader2);
export const LoaderCircle = createThemedIcon('loader_circle', LucideIcons.LoaderCircle);
export const Maximize2 = createThemedIcon('maximize2', LucideIcons.Maximize2);
export const MessageSquareText = createThemedIcon('message_square_text', LucideIcons.MessageSquareText);
export const Monitor = createThemedIcon('monitor', LucideIcons.Monitor);
export const MonitorPlay = createThemedIcon('monitor_play', LucideIcons.MonitorPlay);
export const MoreHorizontal = createThemedIcon('more_horizontal', LucideIcons.MoreHorizontal);
export const MousePointer2 = createThemedIcon('mouse_pointer2', LucideIcons.MousePointer2);
export const MoveRight = createThemedIcon('move_right', LucideIcons.MoveRight);
export const Music = createThemedIcon('music', LucideIcons.Music);
export const Palette = createThemedIcon('palette', LucideIcons.Palette);
export const Pause = createThemedIcon('pause', LucideIcons.Pause);
export const Pencil = createThemedIcon('pencil', LucideIcons.Pencil);
export const Pin = createThemedIcon('pin', LucideIcons.Pin);
export const PinOff = createThemedIcon('pin_off', LucideIcons.PinOff);
export const Play = createThemedIcon('play', LucideIcons.Play);
export const Plus = createThemedIcon('plus', LucideIcons.Plus);
export const Puzzle = createThemedIcon('puzzle', LucideIcons.Puzzle);
export const RefreshCcw = createThemedIcon('refresh_ccw', LucideIcons.RefreshCcw);
export const RefreshCw = createThemedIcon('refresh_cw', LucideIcons.RefreshCw);
export const Rocket = createThemedIcon('rocket', LucideIcons.Rocket);
export const RotateCcw = createThemedIcon('rotate_ccw', LucideIcons.RotateCcw);
export const Save = createThemedIcon('save', LucideIcons.Save);
export const ScanLine = createThemedIcon('scan_line', LucideIcons.ScanLine);
export const Scissors = createThemedIcon('scissors', LucideIcons.Scissors);
export const Search = createThemedIcon('search', LucideIcons.Search);
export const Settings2 = createThemedIcon('settings2', LucideIcons.Settings2);
export const Shield = createThemedIcon('shield', LucideIcons.Shield);
export const ShieldAlert = createThemedIcon('shield_alert', LucideIcons.ShieldAlert);
export const ShieldCheck = createThemedIcon('shield_check', LucideIcons.ShieldCheck);
export const Signature = createThemedIcon('signature', LucideIcons.Signature);
export const SkipBack = createThemedIcon('skip_back', LucideIcons.SkipBack);
export const SkipForward = createThemedIcon('skip_forward', LucideIcons.SkipForward);
export const Sliders = createThemedIcon('sliders', LucideIcons.Sliders);
export const SlidersHorizontal = createThemedIcon('sliders_horizontal', LucideIcons.SlidersHorizontal);
export const Sparkles = createThemedIcon('sparkles', LucideIcons.Sparkles);
export const SplitSquareHorizontal = createThemedIcon('split_square_horizontal', LucideIcons.SplitSquareHorizontal);
export const SplitSquareVertical = createThemedIcon('split_square_vertical', LucideIcons.SplitSquareVertical);
export const Square = createThemedIcon('square', LucideIcons.Square);
export const SquarePlus = createThemedIcon('square_plus', LucideIcons.SquarePlus);
export const SquareSplitHorizontal = createThemedIcon('square_split_horizontal', LucideIcons.SquareSplitHorizontal);
export const Star = createThemedIcon('star', LucideIcons.Star);
export const StarOff = createThemedIcon('star_off', LucideIcons.StarOff);
export const StickyNote = createThemedIcon('sticky_note', LucideIcons.StickyNote);
export const Table = createThemedIcon('table', LucideIcons.Table);
export const Table2 = createThemedIcon('table2', LucideIcons.Table2);
export const Tag = createThemedIcon('tag', LucideIcons.Tag);
export const Tags = createThemedIcon('tags', LucideIcons.Tags);
export const Terminal = createThemedIcon('terminal', LucideIcons.Terminal);
export const TerminalSquare = createThemedIcon('terminal_square', LucideIcons.TerminalSquare);
export const Trash2 = createThemedIcon('trash2', LucideIcons.Trash2);
export const TriangleAlert = createThemedIcon('triangle_alert', LucideIcons.TriangleAlert);
export const Type = createThemedIcon('type', LucideIcons.Type);
export const Undo2 = createThemedIcon('undo2', LucideIcons.Undo2);
export const Upload = createThemedIcon('upload', LucideIcons.Upload);
export const Volume2 = createThemedIcon('volume2', LucideIcons.Volume2);
export const VolumeX = createThemedIcon('volume_x', LucideIcons.VolumeX);
export const Waves = createThemedIcon('waves', LucideIcons.Waves);
export const X = createThemedIcon('x', LucideIcons.X);
export const XCircle = createThemedIcon('xcircle', LucideIcons.XCircle);
export const Zap = createThemedIcon('zap', LucideIcons.Zap);
