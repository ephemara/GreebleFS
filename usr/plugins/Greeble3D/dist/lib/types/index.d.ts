import ReactDOM from 'react-dom/client';
import { Greeble3DApp, type Greeble3DAppProps } from './app/Greeble3DApp';
import { greeble3dRuntimeConfig } from './config/greeble3dRuntime';
import './styles/globals.css';
export { Greeble3DApp, greeble3dRuntimeConfig };
export type { Greeble3DAppProps };
export declare function mountGreeble3D(container: Element, props?: Greeble3DAppProps): ReactDOM.Root;
