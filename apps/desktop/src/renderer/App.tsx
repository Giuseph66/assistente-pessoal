import { useEffect } from 'react';
import { OverlayContainer } from './components/Overlay/OverlayContainer';
import { initSttStore } from './store/sttStore';

function App(): JSX.Element {
    useEffect(() => {
        initSttStore();
    }, []);

    return <OverlayContainer />;
}

export default App
