import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
/** Input values update immediately; the URL keeps filters for contextual returns. */
export function useFilters() { const [route, setRoute] = useSearchParams(); const [params, setLocal] = useState(() => new URLSearchParams(route)); useEffect(() => setLocal(new URLSearchParams(route)), [route]); return [params, (next: URLSearchParams) => { setLocal(next); setRoute(next, { replace: true }); }] as const; }
