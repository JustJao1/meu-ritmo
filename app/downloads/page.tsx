import {redirect} from 'next/navigation';

/** Former Lite downloads route now uses the canonical Meu Ritmo App page. */
export default function DownloadsPage(){redirect('/download');}
