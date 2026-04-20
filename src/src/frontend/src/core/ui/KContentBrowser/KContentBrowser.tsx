import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Folder, Box, File, Settings, ChevronRight, HardDrive, Download, X, Image as ImageIcon, Palette } from 'lucide-react';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '../../types/kernel';

interface KContentBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onDropAsset: (asset: any) => void;
    onImport?: (file: File) => void;
    artifacts: KernelArtifact[];
    materials: KernelMaterial[];
    alphas: KernelAlpha[];
    onOpenInApp?: (appId: string, item: any) => void;
    onDelete?: (item: any) => void;
}

interface FileSystemNode {
    name: string;
    type: 'FOLDER' | 'FILE';
    children: Record<string, FileSystemNode>;
    items: any[];
    isOpen: boolean;
}

export default function KContentBrowser({
    isOpen,
    onClose,
    onDropAsset,
    onImport,
    artifacts = [],
    materials = [],
    alphas = [],
    onOpenInApp,
    onDelete
}: KContentBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activePath, setActivePath] = useState<string[]>(['Content']);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Content']));

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: any } | null>(null);

    // Close context menu on global click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, item: any) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    // --- FILE SYSTEM GENERATION ---
    const fileSystem = useMemo(() => {
        const root: FileSystemNode = { name: 'Content', type: 'FOLDER', children: {}, items: [], isOpen: true };

        const addItem = (item: any, type: 'MESH' | 'MAT' | 'ALPHA') => {
            const folderName = item.source || (type === 'MAT' ? 'Materials' : type === 'ALPHA' ? 'Alphas' : 'Imports');

            // Create Folder if not exists
            if (!root.children[folderName]) {
                root.children[folderName] = {
                    name: folderName,
                    type: 'FOLDER',
                    children: {},
                    items: [],
                    isOpen: false
                };
            }

            root.children[folderName].items.push({ ...item, type });
        };

        artifacts.forEach(a => addItem(a, 'MESH'));
        materials.forEach(m => addItem(m, 'MAT'));
        alphas.forEach(a => addItem(a, 'ALPHA'));

        return root;
    }, [artifacts, materials, alphas]);

    // --- NAVIGATION ---
    const currentFolder = useMemo(() => {
        let current = fileSystem;
        // Verify path exists, else fallback to root
        for (let i = 1; i < activePath.length; i++) {
            if (current.children[activePath[i]]) {
                current = current.children[activePath[i]];
            } else {
                return fileSystem;
            }
        }
        return current;
    }, [fileSystem, activePath]);

    const getDisplayItems = () => {
        let items = [...currentFolder.items];

        // Flatten children items if "All" or similar concept needed, but for now strict folder view
        // Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const allItems: any[] = [];
            const traverse = (node: FileSystemNode) => {
                allItems.push(...node.items);
                Object.values(node.children).forEach(traverse);
            };
            traverse(fileSystem);
            return allItems.filter(i => i.name.toLowerCase().includes(query));
        }

        return items;
    };

    const toggleFolder = (path: string[]) => {
        const pathStr = path.join('/');
        const newSet = new Set(expandedFolders);
        if (newSet.has(pathStr)) newSet.delete(pathStr);
        else newSet.add(pathStr);
        setExpandedFolders(newSet);
    };

    const navigateTo = (path: string[]) => {
        setActivePath(path);
        // Auto expand
        const newSet = new Set(expandedFolders);
        newSet.add(path.join('/'));
        setExpandedFolders(newSet);
    };

    // --- HANDLERS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === 'Escape') onClose();
            // Prevent other shortcuts when focused in search?
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleDragStart = (e: React.DragEvent, item: any) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
    };

    // --- RENDERERS ---

    const renderTree = (node: FileSystemNode, currentPath: string[]) => {
        const pathStr = currentPath.join('/');
        const isExpanded = expandedFolders.has(pathStr);
        const isActive = activePath.join('/') === pathStr;
        const hasChildren = Object.keys(node.children).length > 0;

        return (
            <div key={pathStr} className="pl-2">
                <div
                    onClick={() => navigateTo(currentPath)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs group transition-colors 
                    ${isActive ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-[#222]'}`}
                >
                    <div
                        onClick={(e) => { e.stopPropagation(); toggleFolder(currentPath); }}
                        className={`p-0.5 rounded hover:bg-white/10 ${!hasChildren && node.name !== 'Content' ? 'invisible' : ''}`}
                    >
                        <ChevronRight size={10} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                    <Folder size={12} className={isActive ? 'text-[#e6b455]' : 'text-gray-500 group-hover:text-gray-400'} />
                    <span className="truncate">{node.name}</span>
                    <span className="ml-auto text-[9px] text-gray-600">{node.items.length > 0 ? node.items.length : ''}</span>
                </div>

                {isExpanded && (
                    <div className="border-l border-[#333] ml-3">
                        {Object.values(node.children).map(child => renderTree(child, [...currentPath, child.name]))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`fixed inset-x-0 bottom-0 h-[350px] bg-[#111111] border-t border-[#333] shadow-2xl z-[100] transition-transform duration-300 ease-cubic-out transform ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>

            {/* TOOLBAR */}
            <div className="h-10 border-b border-[#222] flex items-center px-4 justify-between bg-[#161616]">
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-1 bg-[#2a2a2a] hover:bg-[#333] rounded text-white text-xs font-bold border border-[#333] transition-colors">
                        <span className="text-green-500 text-sm font-black">+</span> ADD
                    </button>
                    <label className="flex items-center gap-2 px-3 py-1 bg-[#1a1a1a] hover:bg-[#222] rounded text-gray-300 text-xs font-bold border border-[#333] cursor-pointer transition-colors">
                        <Download size={14} /> IMPORT
                        <input type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0] && onImport) onImport(e.target.files[0]) }} />
                    </label>
                </div>

                <div className="flex items-center gap-2 w-96">
                    <div className="relative flex-1 group">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter Assets..."
                            className="w-full bg-[#050505] border border-[#222] rounded pl-8 pr-2 py-1.5 text-xs text-white focus:border-[#4caf50] outline-none placeholder-gray-700 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="p-1.5 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-colors">
                        <Settings size={14} />
                    </button>
                </div>
            </div>

            {/* MAIN AREA */}
            <div className="flex h-[calc(100%-40px)]">
                {/* SIDEBAR */}
                <div className="w-64 border-r border-[#222] bg-[#111] p-2 overflow-y-auto custom-scrollbar">
                    {renderTree(fileSystem, ['Content'])}
                </div>

                {/* GRID */}
                <div className="flex-1 bg-[#0a0a0a] p-4 overflow-y-auto custom-scrollbar flex flex-col">
                    {/* BREADCRUMBS */}
                    <div className="flex items-center gap-1 text-gray-500 text-xs mb-4 pb-2 border-b border-[#222]/50">
                        {activePath.map((crumb, i) => (
                            <React.Fragment key={i}>
                                <span
                                    onClick={() => navigateTo(activePath.slice(0, i + 1))}
                                    className="hover:text-white cursor-pointer hover:underline transition-all"
                                >
                                    {crumb}
                                </span>
                                {i < activePath.length - 1 && <ChevronRight size={12} className="opacity-50" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* ITEMS */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-3 content-start">
                        {getDisplayItems().map((item, idx) => (
                            <AssetCard
                                key={item.id || idx}
                                item={item}
                                onDragStart={handleDragStart}
                                onDoubleClick={() => onDropAsset(item)}
                                onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, item)}
                            />
                        ))}
                        {getDisplayItems().length === 0 && (
                            <div className="col-span-full py-12 text-center text-gray-700 text-xs font-mono">
                                NO CONTENT FOUND
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CLOSE BUTTON (Keep it subtle) */}
            <button onClick={onClose} className="absolute top-0 right-0 p-3 text-gray-500 hover:text-white transition-colors">
                <X size={16} />
            </button>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <div
                    className="fixed w-48 bg-[#1e1e1e] border border-[#333] shadow-xl rounded-md z-[200] py-1 flex flex-col pointer-events-auto"
                    style={{ top: contextMenu.y - (window.innerHeight - 350 > contextMenu.y ? 0 : 350), left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-[#333] mb-1">
                        Actions
                    </div>

                    <button
                        onClick={() => { onOpenInApp?.('sculpt', contextMenu.item); setContextMenu(null); }}
                        className="text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#007aff] hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Box size={12} /> Open in KSculpt
                    </button>
                    <button
                        onClick={() => { onOpenInApp?.('painter', contextMenu.item); setContextMenu(null); }}
                        className="text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#007aff] hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Palette size={12} /> Open in KPainter
                    </button>

                    <div className="h-px bg-[#333] my-1" />

                    <button
                        onClick={() => { onDelete?.(contextMenu.item); setContextMenu(null); }}
                        className="text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 hover:text-red-200 transition-colors flex items-center gap-2"
                    >
                        <X size={12} /> Delete Asset
                    </button>
                </div>
            )}
        </div>
    );
}

function AssetCard({ item, onDragStart, onDoubleClick, onContextMenu }: any) {
    const isMat = item.type === 'MAT';
    const isAlpha = item.type === 'ALPHA';

    return (
        <div
            className="group flex flex-col gap-1 p-1 rounded-md hover:bg-[#222] cursor-pointer"
            draggable
            onDragStart={(e) => onDragStart(e, item)}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            <div className="aspect-square w-full rounded bg-[#161616] border border-[#222] group-hover:border-[#555] overflow-hidden relative transition-colors">
                {item.thumbnail || item.preview ? (
                    <img src={item.thumbnail || item.preview} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        {isMat && <Palette size={24} className="text-gray-700" />}
                        {isAlpha && <ImageIcon size={24} className="text-gray-700" />}
                        {!isMat && !isAlpha && <Box size={24} className="text-gray-700" />}
                    </div>
                )}

                {/* Type Indicator */}
                <div className={`absolute bottom-0 inset-x-0 h-0.5 ${isMat ? 'bg-green-500' : isAlpha ? 'bg-purple-500' : 'bg-cyan-500'}`} />
            </div>
            <div className="px-1">
                <div className="text-[10px] text-gray-400 group-hover:text-gray-100 truncate font-medium">{item.name}</div>
                <div className="text-[8px] text-gray-600 truncate">{item.type}</div>
            </div>
        </div>
    );
}
