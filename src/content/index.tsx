import { createRoot } from 'react-dom/client';
import App from '../app/App';
import styles from '../styles/index.css?inline';
import { ivacPageDetector } from './pageDetector';
import { workflowEngine } from '../features/workflow/workflowEngine';

const HOST_ELEMENT_ID = 'ivac-booking-assistant-extension-host';

function initAssistant() {
  // Prevent duplicate mounts on SPAs or repeated script executions
  if (document.getElementById(HOST_ELEMENT_ID)) {
    return;
  }

  // Create isolated container host
  const host = document.createElement('div');
  host.id = HOST_ELEMENT_ID;
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.overflow = 'visible';
  host.style.zIndex = '2147483647'; // Maximum z-index to stay above IVAC portal modals

  // Attach Shadow DOM for 100% CSS style isolation
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject bundled Tailwind styles into shadow root
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  // Mount point for React
  const mountPoint = document.createElement('div');
  mountPoint.id = 'ivac-react-root';
  shadow.appendChild(mountPoint);

  document.documentElement.appendChild(host);

  // Initialize React 18 Root
  const root = createRoot(mountPoint);
  root.render(<App />);

  // Subscribe page detector to update workflow engine dynamically
  ivacPageDetector.subscribe((page, _result) => {
    workflowEngine.setDetectedPage(page);
  });
}

// Ensure execution once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initAssistant());
} else {
  initAssistant();
}
