
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from './services/geminiService';
import { decode, decodeAudioData, audioBufferToWav } from './utils/audioUtils';
import { SpeakerIcon, LoaderIcon, PlayIcon, DownloadIcon } from './components/Icons';

const VOICES = [
    { id: 'Kore', name: 'Kore (Female)' },
    { id: 'Puck', name: 'Puck (Male)' },
    { id: 'Charon', name: 'Charon (Male, Deep)' },
    { id: 'Fenrir', name: 'Fenrir (Male)' },
    { id: 'Zephyr', name: 'Zephyr (Female)' },
];

const App: React.FC = () => {
    const [text, setText] = useState<string>("غير كتقرّب التليفون منّو، وكتبان ليك صفحة Google ديالك مباشرة، بلا تطبيقات، بلا إعدادات، كلشي خدام دغيا.");
    const [selectedVoice, setSelectedVoice] = useState<string>(VOICES[0].id);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Reset audio buffer if text or voice changes, prompting a new generation
    useEffect(() => {
        setAudioBuffer(null);
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }
    }, [text, selectedVoice]);

    const handleGenerateAndPlay = useCallback(async () => {
        if (!text.trim()) {
            setError("Please enter some text to generate speech.");
            return;
        }

        setIsLoading(true);
        setError(null);

        // Stop any currently playing audio
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }

        try {
            let bufferToPlay = audioBuffer;

            if (!bufferToPlay) {
                const base64Audio = await generateSpeech(text, selectedVoice);
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                }
                const decodedBytes = decode(base64Audio);
                const newAudioBuffer = await decodeAudioData(decodedBytes, audioContextRef.current, 24000, 1);
                setAudioBuffer(newAudioBuffer);
                bufferToPlay = newAudioBuffer;
            }

            if (bufferToPlay && audioContextRef.current) {
                const source = audioContextRef.current.createBufferSource();
                source.buffer = bufferToPlay;
                source.connect(audioContextRef.current.destination);
                source.start(0);
                audioSourceRef.current = source;
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            setAudioBuffer(null);
        } finally {
            setIsLoading(false);
        }
    }, [text, selectedVoice, audioBuffer]);

    const handleDownload = () => {
        if (!audioBuffer) {
            setError("No audio available to download.");
            return;
        }
        try {
            setError(null);
            const wavBlob = audioBufferToWav(audioBuffer);
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'gemini-tts-audio.wav';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during download.";
            setError(errorMessage);
        }
    };


    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 border border-gray-700">
                <header className="text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Gemini TTS</h1>
                    <p className="text-gray-400 mt-2">Bring your text to life with generative voice.</p>
                </header>

                <div className="space-y-4">
                    <label htmlFor="text-input" className="block text-sm font-medium text-gray-300">
                        Enter Text
                    </label>
                    <textarea
                        id="text-input"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type or paste your text here..."
                        className="w-full h-40 p-4 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-200 resize-y text-gray-200"
                        disabled={isLoading}
                    />
                </div>

                <div className="space-y-4">
                     <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300">
                        Select Voice
                    </label>
                    <select
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow duration-200 text-gray-200"
                        disabled={isLoading}
                    >
                        {VOICES.map((voice) => (
                            <option key={voice.id} value={voice.id}>
                                {voice.name}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-sm border border-red-800">
                        <p><span className="font-bold">Error:</span> {error}</p>
                    </div>
                )}

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                        onClick={handleGenerateAndPlay}
                        disabled={isLoading || !text.trim()}
                        className="sm:col-span-2 w-full flex items-center justify-center gap-3 py-3 px-6 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-500/50"
                    >
                        {isLoading ? (
                            <>
                                <LoaderIcon className="animate-spin h-5 w-5" />
                                <span>Generating...</span>
                            </>
                        ) : audioBuffer ? (
                            <>
                                <PlayIcon className="h-5 w-5" />
                                <span>Play Again</span>
                            </>
                        ) : (
                            <>
                                <SpeakerIcon className="h-5 w-5" />
                                <span>Generate & Play</span>
                            </>
                        )}
                    </button>
                     <button
                        onClick={handleDownload}
                        disabled={!audioBuffer || isLoading}
                        aria-label="Download audio"
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-gray-400/50"
                    >
                        <DownloadIcon className="h-5 w-5" />
                        <span>Download</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;
