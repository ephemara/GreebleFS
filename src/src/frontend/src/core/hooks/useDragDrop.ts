
import React, { useState, useCallback } from 'react';

export const useDragDrop = (onFileDrop: (file: File) => void) => {
    const [isDragging, setIsDragging] = useState(false);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileDrop(e.dataTransfer.files[0]);
        }
    }, [onFileDrop]);

    return { isDragging, dragProps: { onDragOver, onDragEnter: onDragOver, onDragLeave, onDrop } };
};