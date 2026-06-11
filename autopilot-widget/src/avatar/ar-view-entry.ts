import { openArView } from './ar-view';

(window as unknown as { AutopilotArView: typeof openArView }).AutopilotArView = openArView;

export { openArView };
