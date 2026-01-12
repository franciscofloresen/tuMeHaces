import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Disc, Heart } from 'lucide-react';

// --- CONFIGURACIÓN ---
const SONG_METADATA = {
    title: "Tu Me Haces",
    artist: "Crylo",
    album: "Tu Me Haces",
    audioSrc: "/song.mp3" // Asegúrate de que este archivo esté en la carpeta public
};

const LRC_CONTENT = `
[00:16.05]Oro en la arena, bailando en la luz
[00:19.49]Espero a que el cielo me lleve hacia tu cruz
[00:23.51]Sigo creyendo, mirando hacia el mar
[00:27.03]El mundo es de nosotros, no hay nada que explicar
[00:30.79]Tus manos son guía, tu aliento es mi paz
[00:34.56]No busco el destino si a mi lado estás
[00:38.48]Perdidos en tiempo, fundidos en fe
[00:42.12]Todo lo que soñaba en tus ojos lo hallé
[00:47.16]Me haces sentir algo nuevo
[00:50.70]Me haces sentir algo nuevo
[00:54.86]Me haces sentir algo nuevo
[00:58.19]Me haces sentir algo nuevo
[01:04.72]Tú me haces...
[01:35.75]Entro en tu océano, hundo mi piel
[01:40.14]Prometo secretos con sabor a miel
[01:43.93]Bésame suave, dime algo dulce
[01:47.71]Danzando en el borde, que el ritmo nos pulse
[01:51.49]No existe el tiempo, solo tu voz
[01:55.38]Un universo para los dos
[01:59.07]Si el sol no despierta, no importa mi bien
[02:02.64]Porque en tu latido yo nazco otra vez
[02:06.62]Sin miedos, sin sombras, solo claridad
[02:11.11]Tu amor es mi única verdad
[02:14.02]Flotando en la nada, sintiéndolo todo...
[02:20.70]Me haces sentir algo nuevo
[02:24.43]Me haces sentir algo nuevo
[02:28.34]Me haces sentir algo nuevo
[02:31.96]Me haces sentir algo nuevo
[02:38.52]Tú me haces...
[03:10.15]Algo nuevo...
[03:14.30]Bajo las estrellas...
[03:17.84]Solo tú y yo, en este silencio...
`;

// --- PARSER MEJORADO ---
// Detecta huecos instrumentales y agrega "..."
const parseLRC = (lrc) => {
    const rawLines = lrc.split('\n').map(line => {
        const m = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
        return m ? { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() } : null;
    }).filter(l => l?.text);

    // Ordenar por si acaso
    rawLines.sort((a, b) => a.time - b.time);

    const processedLines = [];
    const INSTRUMENTAL_GAP = 10; // Segundos mínimos para considerar un instrumental

    // 1. Checar Intro
    if (rawLines.length > 0 && rawLines[0].time > 5) {
        processedLines.push({
            time: 0,
            text: "...",
            isInstrumental: true
        });
    }

    // 2. Procesar líneas y detectar huecos
    for (let i = 0; i < rawLines.length; i++) {
        processedLines.push(rawLines[i]);

        // Si no es la última línea
        if (i < rawLines.length - 1) {
            const currentEndTime = rawLines[i].time + 3; // Asumimos 3 seg de lectura aprox
            const nextStartTime = rawLines[i + 1].time;
            const gap = nextStartTime - rawLines[i].time;

            if (gap > INSTRUMENTAL_GAP) {
                // Agregar línea instrumental en medio del hueco
                processedLines.push({
                    time: rawLines[i].time + 4, // Aparece poco después de que termine la línea actual
                    text: "...",
                    isInstrumental: true
                });
            }
        }
    }

    return processedLines;
};

export default function App() {
    // --- ESTADOS ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [activeLineIndex, setActiveLineIndex] = useState(-1);
    const [bassIntensity, setBassIntensity] = useState(1);

    // --- REFS ---
    const audioRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const animationFrameRef = useRef(null);
    const activeLineRef = useRef(null);

    const lyrics = useMemo(() => parseLRC(LRC_CONTENT), []);

    // --- AUDIO ENGINE ---
    const initAudio = () => {
        if (!audioContextRef.current) {
            const AC = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AC();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;

            // Conexión
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }
    };

    const animate = () => {
        if (audioRef.current && analyserRef.current) {
            const bufferLength = analyserRef.current.frequencyBinCount;
            const data = new Uint8Array(bufferLength);
            analyserRef.current.getByteFrequencyData(data);

            // Detectar Bajos (primeras 10 bandas)
            const bass = [...data.slice(0, 10)].reduce((a, b) => a + b, 0) / 10;
            // Cálculo suavizado para la intensidad (1.0 a 1.2 aprox)
            const intensity = 1 + (bass / 255) * 0.20;

            setBassIntensity(intensity);
            setCurrentTime(audioRef.current.currentTime);
        }
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const togglePlay = async () => {
        if (isPlaying) {
            audioRef.current.pause();
            cancelAnimationFrame(animationFrameRef.current);
            setIsPlaying(false);
        } else {
            initAudio();
            if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
            audioRef.current.play();
            animate();
            setIsPlaying(true);
        }
    };

    // --- EFECTOS ---

    // Sincronización de Lyrics
    useEffect(() => {
        const idx = lyrics.findIndex((l, i) => {
            const nextTime = lyrics[i + 1]?.time ?? Infinity;
            return currentTime >= l.time && currentTime < nextTime;
        });
        if (idx !== -1 && idx !== activeLineIndex) setActiveLineIndex(idx);
    }, [currentTime, lyrics, activeLineIndex]);

    // Scroll Automático
    useEffect(() => {
        activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [activeLineIndex]);

    // Limpieza al terminar
    const onEnded = () => {
        setIsPlaying(false);
        cancelAnimationFrame(animationFrameRef.current);
        setBassIntensity(1);
        setCurrentTime(0);
        setActiveLineIndex(-1);
    };

    return (
        <div className="app-container">
            {/* INYECCIÓN DE CSS (Reemplazo de Tailwind) */}
            <style>{`
                :root {
                    --color-bg: #050505;
                    --color-text-dim: #555;
                    --color-text-light: #fff;
                    --color-accent: #db2777; /* Rosa */
                    --font-main: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                body {
                    background-color: var(--color-bg);
                    font-family: var(--font-main);
                    overflow: hidden; /* Evitar scroll en body */
                }

                .app-container {
                    position: relative;
                    width: 100vw;
                    height: 100vh;
                    overflow: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: white;
                }

                /* --- FONDO ANIMADO --- */
                .bg-wrapper {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 0;
                    pointer-events: none;
                    transition: transform 0.1s ease-out;
                    opacity: 0.6;
                }
                .blob {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(80px);
                    opacity: 0.5;
                    animation: float 10s infinite ease-in-out;
                }
                .blob-1 { top: -10%; left: -10%; width: 60vw; height: 60vw; background: #4c1d95; }
                .blob-2 { bottom: -10%; right: -10%; width: 60vw; height: 60vw; background: #be185d; animation-delay: -5s; }

                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(30px, 50px); }
                }

                /* --- LAYOUT PRINCIPAL --- */
                .content {
                    position: relative;
                    z-index: 10;
                    display: flex;
                    width: 100%;
                    max-width: 1200px;
                    height: 100%;
                    padding: 40px;
                    gap: 60px;
                }

                /* Lado Izquierdo (Cover + Controles) */
                .player-section {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }

                .cover-art {
                    width: 320px;
                    height: 320px;
                    border-radius: 20px;
                    background: linear-gradient(145deg, #1a1a1a, #000);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column; /* Apilar icono y texto */
                    justify-content: center;
                    align-items: center;
                    margin-bottom: 40px;
                    border: 1px solid rgba(255,255,255,0.1);
                    transition: box-shadow 0.1s ease-out;
                    gap: 15px; /* Espacio entre icono y texto */
                }
                
                .cover-text {
                    font-size: 0.9rem;
                    color: rgba(255,255,255,0.4);
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .spin-animation {
                    animation: spin 8s linear infinite;
                }
                
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .meta-title { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; }
                .meta-artist { font-size: 1.25rem; color: #fb7185; font-weight: 500; margin-bottom: 30px; }

                .controls { display: flex; align-items: center; gap: 20px; }
                
                .btn-play {
                    width: 80px; height: 80px;
                    border-radius: 50%;
                    background: white;
                    color: black;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 0 30px rgba(255,255,255,0.2);
                }
                .btn-play:hover { transform: scale(1.1); }
                .btn-play:active { transform: scale(0.95); }

                /* Lado Derecho (Letras) */
                .lyrics-section {
                    flex: 1.2;
                    position: relative;
                    height: 80vh; /* Altura fija para el scroll */
                    align-self: center;
                    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
                    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
                }

                .lyrics-container {
                    height: 100%;
                    overflow-y: auto;
                    padding: 50vh 0; /* Espacio para centrar la primera y última línea */
                    scrollbar-width: none; /* Firefox */
                    display: flex;
                    flex-direction: column;
                    align-items: center; /* Centrar elementos horizontalmente */
                }
                .lyrics-container::-webkit-scrollbar { display: none; } /* Chrome/Safari */

                .lyric-line {
                    font-size: 2.2rem;
                    font-weight: 700;
                    line-height: 1.4;
                    margin-bottom: 30px;
                    cursor: pointer;
                    transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1);
                    transform-origin: center center; /* Transformar desde el centro */
                    text-align: center; /* Centrar texto */
                    max-width: 90%; /* Evitar que toque los bordes */
                    opacity: 0.3;
                    filter: blur(1px);
                    color: #aaa;
                }

                .lyric-line.active {
                    opacity: 1;
                    filter: blur(0);
                    color: white;
                }
                
                /* --- ESTILO INSTRUMENTAL --- */
                .instrumental-dots {
                    display: inline-flex;
                    gap: 8px;
                    font-size: 3rem; /* Más grande */
                    color: var(--color-accent);
                    opacity: 0.8;
                }
                .dot {
                    animation: dotPulse 1.5s infinite ease-in-out;
                }
                .dot:nth-child(2) { animation-delay: 0.2s; }
                .dot:nth-child(3) { animation-delay: 0.4s; }

                @keyframes dotPulse {
                    0%, 100% { opacity: 0.2; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                }

                .lyric-line:hover {
                    opacity: 0.8;
                }
                
                /* Footer discreto */
                .footer {
                    position: absolute;
                    bottom: 20px;
                    font-size: 0.75rem;
                    color: rgba(255,255,255,0.2);
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    z-index: 20;
                    pointer-events: none;
                }

                /* --- RESPONSIVE (MÓVIL) --- */
                @media (max-width: 768px) {
                    .content {
                        flex-direction: column;
                        padding: 20px;
                        padding-bottom: 60px;
                        gap: 15px;
                        height: 100%;
                        overflow: hidden;
                    }
                    
                    .player-section {
                        flex: 0 0 auto;
                        padding-top: 10px;
                    }
                    
                    .cover-art {
                        width: 120px; height: 120px;
                        margin-bottom: 10px;
                    }
                    
                    .cover-text { font-size: 0.6rem; }

                    .meta-title { font-size: 1.4rem; margin-bottom: 2px; }
                    .meta-artist { font-size: 0.9rem; margin-bottom: 10px; }
                    
                    .btn-play { width: 50px; height: 50px; }

                    .lyrics-section {
                        flex: 1;
                        height: 40vh;
                        min-height: 200px;
                        width: 100%;
                        mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
                        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
                    }
                    
                    .lyrics-container {
                        padding: 20vh 0;
                    }

                    .lyric-line {
                        font-size: 1.2rem;
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    
                    .instrumental-dots { font-size: 2rem; }
                    
                    .footer {
                        bottom: 15px;
                    }
                }
            `}</style>

            {/* ELEMENTOS VISUALES DE FONDO */}
            <div className="bg-wrapper" style={{ transform: `scale(${bassIntensity})` }}>
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
            </div>

            <div className="content">
                {/* SECCIÓN JUGADOR (COVER + BOTONES) */}
                <div className="player-section">
                    <div
                        className="cover-art"
                        style={{
                            boxShadow: `0 0 ${bassIntensity * 30}px rgba(190, 24, 93, 0.4)`
                        }}
                    >
                        <Disc
                            size={isPlaying ? 120 : 80}
                            color="rgba(255,255,255,0.2)"
                            className={isPlaying ? "spin-animation" : ""}
                        />
                        <span className="cover-text">Artwork en proceso</span>
                    </div>

                    <h1 className="meta-title">{SONG_METADATA.title}</h1>
                    <h2 className="meta-artist">{SONG_METADATA.artist}</h2>

                    <div className="controls">
                        <button className="btn-play" onClick={togglePlay}>
                            {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" style={{marginLeft: 4}} />}
                        </button>
                    </div>
                </div>

                {/* SECCIÓN LETRAS */}
                <div className="lyrics-section">
                    <div className="lyrics-container">
                        {lyrics.map((line, i) => {
                            const isActive = i === activeLineIndex;
                            return (
                                <p
                                    key={i}
                                    ref={isActive ? activeLineRef : null}
                                    className={`lyric-line ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (audioRef.current) {
                                            audioRef.current.currentTime = line.time;
                                            setCurrentTime(line.time);
                                        }
                                    }}
                                    style={{
                                        // Reactividad extra fina en la línea activa
                                        transform: isActive
                                            ? `scale(${1 + (bassIntensity - 1) * 0.15})`
                                            : 'scale(0.95)',
                                        textShadow: isActive && !line.isInstrumental
                                            ? `0 0 ${bassIntensity * 10}px rgba(255,255,255,0.4)`
                                            : 'none'
                                    }}
                                >
                                    {line.isInstrumental ? (
                                        <span className="instrumental-dots">
                                            <span className="dot">.</span>
                                            <span className="dot">.</span>
                                            <span className="dot">.</span>
                                        </span>
                                    ) : (
                                        line.text
                                    )}
                                </p>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className="footer">Para Sarah</div>

            <audio
                ref={audioRef}
                src={SONG_METADATA.audioSrc}
                onEnded={onEnded}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                preload="auto"
                crossOrigin="anonymous"
            />
        </div>
    );
}