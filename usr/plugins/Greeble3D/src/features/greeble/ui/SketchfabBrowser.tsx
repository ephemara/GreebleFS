import React, { useState, useEffect } from 'react';
import { Search, Download, X, Loader2, Key, Image as ImageIcon } from 'lucide-react';
import { searchSketchfab, getSketchfabDownloadUrl, SketchfabModel } from '@/services/sketchfabService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { greeble3dRuntimeConfig } from '@/config/greeble3dRuntime';

interface SketchfabBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (url: string, name: string) => void;
}

export function SketchfabBrowser({ isOpen, onClose, onImport }: SketchfabBrowserProps) {
    const tokenStorageKey = greeble3dRuntimeConfig.storage.sketchfabTokenKey;
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SketchfabModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string>('');
    const [cursor, setCursor] = useState<string | null>(null);

    // Load token from local storage
    useEffect(() => {
        const savedToken = localStorage.getItem(tokenStorageKey);
        if (savedToken) setToken(savedToken);
    }, [tokenStorageKey]);

    const handleSearch = async (newSearch = true) => {
        if (!query.trim()) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const currentCursor = newSearch ? undefined : cursor;
            const data = await searchSketchfab(query, { 
                token: token || undefined, 
                cursor: currentCursor || undefined 
            });
            
            if (newSearch) {
                setResults(data.models);
            } else {
                setResults(prev => [...prev, ...data.models]);
            }
            setCursor(data.nextCursor);
        } catch (err) {
            setError('Failed to search Sketchfab. Please check your API token.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch(true);
    };

    const handleDownload = async (model: SketchfabModel) => {
        if (!token) {
            setError('API Token is required to download models.');
            return;
        }

        setImporting(model.uid);
        setError(null);

        try {
            const url = await getSketchfabDownloadUrl(model.uid, token);
            if (url) {
                onImport(url, model.name);
                onClose();
            } else {
                setError('Could not get download URL. Model might not be downloadable.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to download model.');
        } finally {
            setImporting(null);
        }
    };

    const saveToken = (val: string) => {
        setToken(val);
        localStorage.setItem(tokenStorageKey, val);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#111] border border-[#333] w-full max-w-4xl h-[80vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-[#222] flex items-center justify-between bg-[#161616]">
                    <div className="flex items-center gap-2 text-orange-500 font-bold tracking-wider">
                        <Download size={20} /> SKETCHFAB BROWSER
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-[#222] bg-[#0a0a0a] flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <Input 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search 3D models..." 
                            className="pl-9 bg-[#111] border-[#333] text-white focus:border-orange-500"
                        />
                    </div>
                    <Button 
                        onClick={() => handleSearch(true)}
                        disabled={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : 'SEARCH'}
                    </Button>
                    
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-[#333] text-gray-400 hover:text-white hover:bg-[#222]">
                                <Key size={16} className="mr-2" /> {token ? 'TOKEN SET' : 'SET TOKEN'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#111] border-[#333] text-white">
                            <DialogHeader>
                                <DialogTitle>Sketchfab API Token</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                                <p className="text-sm text-gray-400">
                                    To search and download models, you need a Sketchfab API Token.
                                    You can find it in your Sketchfab account settings under "Password & API".
                                </p>
                                <Input 
                                    value={token}
                                    onChange={(e) => saveToken(e.target.value)}
                                    placeholder="Paste your API Token here"
                                    type="password"
                                    className="bg-[#0a0a0a] border-[#333]"
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#050505] custom-scrollbar">
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded text-red-400 text-sm font-bold text-center">
                            {error}
                        </div>
                    )}

                    {results.length === 0 && !loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4">
                            <ImageIcon size={48} className="opacity-20" />
                            <p className="text-sm font-bold tracking-widest">NO MODELS FOUND</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {results.map((model) => (
                                <div key={model.uid} className="group relative bg-[#111] border border-[#222] rounded-lg overflow-hidden hover:border-orange-500 transition-all">
                                    <div className="aspect-square relative overflow-hidden bg-[#0a0a0a]">
                                        {model.thumbnails.images.length > 0 && (
                                            <img 
                                                src={model.thumbnails.images.sort((a,b) => b.width - a.width)[0].url} 
                                                alt={model.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button 
                                                onClick={() => handleDownload(model)}
                                                disabled={importing === model.uid}
                                                className="bg-orange-600 hover:bg-orange-700 text-white font-bold tracking-wider"
                                            >
                                                {importing === model.uid ? <Loader2 className="animate-spin" size={16} /> : 'IMPORT'}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="text-xs font-bold text-gray-300 truncate" title={model.name}>{model.name}</h3>
                                        <p className="text-[10px] text-gray-500 truncate mt-1">by {model.user.displayName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {results.length > 0 && cursor && (
                        <div className="mt-8 flex justify-center">
                            <Button 
                                onClick={() => handleSearch(false)}
                                disabled={loading}
                                variant="outline"
                                className="border-[#333] text-gray-400 hover:text-white hover:bg-[#222]"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : 'LOAD MORE'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
