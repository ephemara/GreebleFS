/**
 * Greeble Demo Page
 * 
 * Web demo of K-Greeble - a procedural 3D greebling tool.
 * This is a stripped-down standalone version for the website.
 */

import KGreeble from './KGreeble'

export function GreebleDemoPage() {
    return (
        <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col overflow-hidden">
            {/* Greeble Canvas */}
            <div className="flex-1">
                <KGreeble sharedState={null} onCommit={undefined} />
            </div>
        </div>
    )
}
