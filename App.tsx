import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from './services/geminiService';
import { decode, decodeAudioData, audioBufferToMp3 } from './utils/audioUtils';
import { SpeakerIcon, LoaderIcon, PlayIcon, PauseIcon, DownloadIcon, SoundWaveIcon, VolumeHighIcon, VolumeMuteIcon, SpeedIcon } from './components/Icons';

const VOICES = [
    { id: 'Kore', name: 'زينب (صوت ديال مرا)' },
    { id: 'Puck', name: 'باك (صوت ديال راجل)' },
    { id: 'Charon', name: 'شارون (صوت ديال راجل، غليض)' },
    { id: 'Fenrir', name: 'فنرير (صوت ديال راجل)' },
    { id: 'Zephyr', name: 'زفير (صوت ديال مرا)' }
];

const App: React.FC = () => {
    const [text, setText] = useState<string>("");
    const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0].id);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Playback state
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(1);
    const [lastVolume, setLastVolume] = useState<number>(1);
    const [playbackRate, setPlaybackRate] = useState<number>(1);


    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const previewAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // FIX: The useRef hook requires an initial value.
    // Initialized with null and updated the type to `number | null` to fix the "Expected 1 arguments, but got 0" error.
    const animationFrameRef = useRef<number | null>(null);
    const playbackStartTimeRef = useRef<number>(0);
    const startOffsetRef = useRef<number>(0);


    const stopPlayback = useCallback((sourceNode?: 'main' | 'preview') => {
        if (sourceNode === 'main' || sourceNode === undefined) {
             if (audioSourceRef.current) {
                audioSourceRef.current.onended = null;
                audioSourceRef.current.stop(0);
                audioSourceRef.current = null;
            }
        }
        if (sourceNode === 'preview' || sourceNode === undefined) {
            if (previewAudioSourceRef.current) {
                previewAudioSourceRef.current.stop(0);
                previewAudioSourceRef.current = null;
            }
        }
        
        setIsPlaying(false);
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }, []);

    useEffect(() => {
        stopPlayback();
        setAudioBuffer(null);
        setCurrentTime(0);
        setDuration(0);
    }, [text, selectedVoice, stopPlayback]);

    useEffect(() => {
        return () => {
            stopPlayback();
            audioContextRef.current?.close();
        };
    }, [stopPlayback]);
    
    const setupAudioContext = () => {
        if (!audioContextRef.current) {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioContextRef.current = context;
            const gainNode = context.createGain();
            gainNode.connect(context.destination);
            gainNodeRef.current = gainNode;
        }
    }

    const updateProgress = useCallback(() => {
        if (isPlaying && audioContextRef.current) {
            const elapsedTime = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * playbackRate;
            const newTime = startOffsetRef.current + elapsedTime;
            setCurrentTime(newTime);
            animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
    }, [isPlaying, playbackRate]);

    const play = useCallback(() => {
        if (!audioBuffer || !audioContextRef.current || !gainNodeRef.current) return;

        stopPlayback('main');

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNodeRef.current);
        source.playbackRate.value = playbackRate;
        
        const offset = startOffsetRef.current >= audioBuffer.duration ? 0 : startOffsetRef.current;
        source.start(0, offset);
        
        source.onended = () => {
            if (!audioContextRef.current) return;
            const newOffset = startOffsetRef.current + (audioContextRef.current.currentTime - playbackStartTimeRef.current) * playbackRate;
            startOffsetRef.current = newOffset >= audioBuffer.duration - 0.01 ? 0 : newOffset;
            
            setIsPlaying(false);
            if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            
            if (newOffset >= audioBuffer.duration - 0.01) {
                setCurrentTime(audioBuffer.duration);
            }
        };

        audioSourceRef.current = source;
        playbackStartTimeRef.current = audioContextRef.current.currentTime;
        
        setIsPlaying(true);
        animationFrameRef.current = requestAnimationFrame(updateProgress);

    }, [audioBuffer, stopPlayback, updateProgress, playbackRate]);

    const pause = useCallback(() => {
        if (!audioContextRef.current || !audioSourceRef.current) return;
        
        const elapsedTime = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * playbackRate;
        startOffsetRef.current = startOffsetRef.current + elapsedTime;
        
        stopPlayback('main');
    }, [stopPlayback, playbackRate]);
    
    const handleTogglePlayPause = () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };
    
    useEffect(() => {
      if (gainNodeRef.current && audioContextRef.current) {
        gainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
      }
    }, [volume])

    const handleToggleMute = () => {
        if (volume > 0) {
            setLastVolume(volume);
            setVolume(0);
        } else {
            setVolume(lastVolume > 0 ? lastVolume : 1);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setLastVolume(newVolume > 0 ? newVolume : lastVolume);
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newRate = parseFloat(e.target.value);
        setPlaybackRate(newRate);
        if (audioSourceRef.current && audioContextRef.current) {
            audioSourceRef.current.playbackRate.setValueAtTime(newRate, audioContextRef.current.currentTime);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime);
        startOffsetRef.current = newTime;
        if (isPlaying) {
            play();
        }
    };

    const handleGenerateAudio = useCallback(async () => {
        if (!text.trim()) {
            setError("عافاك كتب شي حاجة باش نحولوها لصوت.");
            return;
        }

        setIsLoading(true);
        setError(null);
        stopPlayback();
        setAudioBuffer(null);

        try {
            setupAudioContext();
            const base64Audio = await generateSpeech(text, selectedVoice);
            
            const decodedBytes = decode(base64Audio);
            const newAudioBuffer = await decodeAudioData(decodedBytes, audioContextRef.current!, 24000, 1);
            
            setAudioBuffer(newAudioBuffer);
            setDuration(newAudioBuffer.duration);
            setCurrentTime(0);
            startOffsetRef.current = 0;
            
            // Auto-play
            play();

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "وقع شي مشكل غير متوقع.";
            setError(errorMessage);
            setAudioBuffer(null);
        } finally {
            setIsLoading(false);
        }
    }, [text, selectedVoice, stopPlayback, play]);

    const handlePreviewVoice = async () => {
        const PREVIEW_TEXT = "هادا غي تجريب ديال الصوت";
        setIsPreviewLoading(true);
        setError(null);
        stopPlayback();

        try {
            setupAudioContext();
            const base64Audio = await generateSpeech(PREVIEW_TEXT, selectedVoice);
            const decodedBytes = decode(base64Audio);
            const previewBuffer = await decodeAudioData(decodedBytes, audioContextRef.current!, 24000, 1);

            if (previewBuffer && audioContextRef.current && gainNodeRef.current) {
                const source = audioContextRef.current.createBufferSource();
                source.buffer = previewBuffer;
                source.connect(gainNodeRef.current);
                source.start(0);
                previewAudioSourceRef.current = source;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "ما قدرناش نجرّبو هاد الصوت.";
            setError(errorMessage);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleDownload = () => {
        if (!audioBuffer) {
            setError("ما كاين حتا أوديو باش تيليشارجيه.");
            return;
        }
        try {
            setError(null);
            const mp3Blob = audioBufferToMp3(audioBuffer);
            const url = URL.createObjectURL(mp3Blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            const safeText = text.substring(0, 25).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').toLowerCase() || 'audio';
            const timestamp = new Date().getTime();
            a.download = `gemini-tts-${safeText}-${timestamp}.mp3`;
            
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "وقع شي مشكل فتيليشارجمون.";
            setError(errorMessage);
        }
    };
    
    const formatTime = (timeInSeconds: number): string => {
        if (isNaN(timeInSeconds) || timeInSeconds < 0) return '0:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };


    return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans">
            <div dir="rtl" className="w-full max-w-2xl bg-gray-900/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 border border-blue-800/50">
                <header className="text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-amber-400">Gemini: حوّل لكتبة لهضرة</h1>
                    <p className="text-gray-400 mt-2">حوّل لكتبة ديالك لهضرة، بالصوت اللي كيعجبك.</p>
                </header>

                <div className="space-y-4">
                    <label htmlFor="text-input" className="block text-sm font-medium text-gray-300 text-right">
                        كتب النص ديالك هنا (بالدارجة)
                    </label>
                    <textarea
                        id="text-input"
                        dir="rtl"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="كتب ولا كولي النص ديالك هنا..."
                        className="w-full h-40 p-4 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow duration-200 resize-y text-gray-200"
                        disabled={isLoading || isPreviewLoading}
                    />
                </div>

                <div className="space-y-4">
                     <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 text-right">
                        ختار الصوت اللي بغيتي
                    </label>
                    <div className="flex items-center gap-3">
                        <select
                            id="voice-select"
                            value={selectedVoice}
                            onChange={(e) => setSelectedVoice(e.target.value)}
                            className="flex-grow w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow duration-200 text-gray-200"
                            disabled={isLoading || isPreviewLoading}
                        >
                            {VOICES.map((voice) => (
                                <option key={voice.id} value={voice.id}>
                                    {voice.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handlePreviewVoice}
                            disabled={isLoading || isPreviewLoading}
                            aria-label="جرّب هاد الصوت"
                            className="flex-shrink-0 flex items-center justify-center p-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                        >
                            {isPreviewLoading ? (
                                <LoaderIcon className="animate-spin h-5 w-5" />
                            ) : (
                                <SoundWaveIcon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-sm border border-red-800">
                        <p><span className="font-bold">مشكل:</span> {error}</p>
                    </div>
                )}

                <div className="pt-2 space-y-4">
                    {!audioBuffer ? (
                         <button
                            onClick={handleGenerateAudio}
                            disabled={isLoading || !text.trim() || isPreviewLoading}
                            className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
                        >
                            {isLoading ? (
                                <>
                                    <LoaderIcon className="animate-spin h-5 w-5" />
                                    <span>كيتصاوب دابا...</span>
                                </>
                            ) : (
                                <>
                                    <SpeakerIcon className="h-5 w-5" />
                                    <span>حوّل لصوت</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="bg-gray-800/60 p-4 rounded-lg border border-gray-700 space-y-4">
                            <div dir="ltr" className="flex items-center gap-4">
                                <button onClick={handleTogglePlayPause} className="p-2 rounded-full bg-blue-700 hover:bg-blue-600 text-white transition-colors">
                                    {isPlaying ? <PauseIcon className="h-6 w-6"/> : <PlayIcon className="h-6 w-6"/>}
                                </button>
                                <span className="text-sm text-gray-400 font-mono w-12">{formatTime(currentTime)}</span>
                                <input
                                    type="range"
                                    min="0"
                                    max={duration}
                                    step="0.01"
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                                <span className="text-sm text-gray-400 font-mono w-12">{formatTime(duration)}</span>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                                <div className="flex items-center gap-3">
                                    <button onClick={handleToggleMute}>
                                        {volume > 0 ? <VolumeHighIcon className="h-6 w-6 text-gray-400 hover:text-white" /> : <VolumeMuteIcon className="h-6 w-6 text-gray-400 hover:text-white" />}
                                    </button>
                                    <input
                                        type="range" min="0" max="1" step="0.01" value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                        aria-label="تحكم فالصوت"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <SpeedIcon className="h-6 w-6 text-gray-400"/>
                                    <input
                                        type="range" min="0.5" max="2" step="0.1" value={playbackRate}
                                        onChange={handleSpeedChange}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                        aria-label="سرعة القراية"
                                    />
                                    <span className="text-sm font-mono text-gray-400 w-10 text-center">{playbackRate.toFixed(1)}x</span>
                                </div>
                                <div className="md:col-span-2">
                                     <button
                                        onClick={handleDownload}
                                        disabled={!audioBuffer || isLoading || isPreviewLoading}
                                        aria-label="تيليشارجي الملف الصوتي"
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
                                    >
                                        <DownloadIcon className="h-5 w-5" />
                                        <span>تيليشارجي MP3</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;