import { useState } from 'react';

/** Streaming via Range API; caminho estático fica como contingência. */
export default function VideoConvite({ etiqueta = 'Vídeo convite' }) {
  const [source, setSource] = useState('/api/video-convite');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  function onError() {
    if (source === '/api/video-convite') setSource('/video-convite.mp4');
    else setFailed(true);
  }
  function retry() { setFailed(false); setSource('/api/video-convite'); setAttempt(a => a + 1); }
  return <div className="hero-video has-video">
    {failed ? <div role="alert" style={{textAlign:'center',maxWidth:500}}>
      <p>Não foi possível carregar o vídeo neste momento.</p>
      <p className="caption">Verifique a conexão e tente novamente. O restante do site continua disponível.</p>
      <button className="btn secondary" type="button" onClick={retry}>TENTAR NOVAMENTE</button>
    </div> : <video
      key={source + attempt}
      className="embedded-video"
      controls
      playsInline
      preload="metadata"
      poster="/artecoracao.jpg"
      aria-label={etiqueta}
      onError={onError}
    ><source src={source} type="video/mp4" />Seu navegador não suporta vídeo MP4.</video>}
  </div>;
}
