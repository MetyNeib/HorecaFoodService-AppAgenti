import { decodeState } from './persistence';
import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react';
import { initialState, reducer, type State, type Action, type Data } from '../domain/model';
const key = 'hfs-agent-demo-v1';
function read(): State { try {
    const raw = localStorage.getItem(key);
    return raw ? decodeState(raw) : initialState();
}
catch {
    return { ...initialState(), warning: 'Dati locali non leggibili o incompatibili. La demo è in memoria: ripristina esplicitamente il seed con Reset demo.' };
} }
const Context = createContext<null | {
    state: State;
    dispatch: React.Dispatch<Action>;
    update: (f: (d: Data) => void) => void;
    notice: string;
    notify: (s: string) => void;
    storageError: string;
}>(null);
export function Provider({ children }: {
    children: ReactNode;
}) { const [state, dispatch] = useReducer(reducer, undefined, read); const [notice, notify] = useState(''); const [storageError, setError] = useState(''); useEffect(() => { if (state.warning)
    return; try {
    localStorage.setItem(key, JSON.stringify(state));
    setError('');
}
catch {
    setError('Memoria locale non disponibile: le modifiche restano solo in questa sessione.');
} }, [state]); useEffect(() => { if (state.network !== 'SYNCING')
    return; const timer = setTimeout(() => dispatch({ type: 'SYNC' }), 800); return () => clearTimeout(timer); }, [state.network, state.revision]); useEffect(() => { if (!notice)
    return; const timer = setTimeout(() => notify(''), 5000); return () => clearTimeout(timer); }, [notice]); return <Context.Provider value={{ state, dispatch, update: f => dispatch({ type: 'DATA', update: f }), notice, notify, storageError }}>{children}</Context.Provider>; }
export function useApp() { const c = useContext(Context); if (!c)
    throw Error('Provider mancante'); return c; }
