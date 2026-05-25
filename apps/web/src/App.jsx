import React, { useState, useEffect } from 'react';
import * as TON_CONNECT_UI from '@tonconnect/ui';

const CONTRACT_ADDRESS = "kQBJ8ihO3VrpqT48fK4d9dGaI4la6_OQj72p69wV-Nj0r4_m";

const AudioEngine = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playTone(freq, type, duration, vol = 0.1) {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
    },
    sfx: {
        tick: () => AudioEngine.playTone(150, 'square', 0.05, 0.05),
        urgent: () => AudioEngine.playTone(300, 'square', 0.05, 0.08),
        select: () => AudioEngine.playTone(600, 'square', 0.1),
        lock: () => {
            AudioEngine.playTone(400, 'square', 0.1);
            setTimeout(() => AudioEngine.playTone(800, 'square', 0.15), 50);
        },
        newRound: () => { [440, 554, 659].forEach((f, i) => setTimeout(() => AudioEngine.playTone(f, 'square', 0.2, 0.05), i * 100)); },
        nav: () => AudioEngine.playTone(200, 'square', 0.1, 0.05)
    }
};

function App() {
    const [screen, setScreen] = useState('GAME'); // GAME, PROFILE, HELP
    const [livePrice, setLivePrice] = useState(null);
    const [startPrice, setStartPrice] = useState(null);
    const [timeLeft, setTimeLeft] = useState(60);
    const [round, setRound] = useState(1);
    const [pricePath, setPricePath] = useState(Array(40).fill(10));
    const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('bl_history') || '[]'));

    const [tonConnectUI, setTonConnectUI] = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);
    const [isBetting, setIsBetting] = useState(false);
    const [selectedSide, setSelectedSide] = useState('LONG');
    const [betAmount, setAmount] = useState('1');

    useEffect(() => {
        const ui = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: window.location.origin + '/tonconnect-manifest.json',
        });
        setTonConnectUI(ui);
        const unsubscribe = ui.onStatusChange(w => setWalletAddress(w?.account?.address || null));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
                const data = await res.json();
                const val = data?.['the-open-network']?.usd;
                if (val) {
                    setLivePrice(val);
                    setStartPrice(prev => prev === null ? val : prev);
                }
            } catch (e) {}
        };
        fetchPrice();
        const interval = setInterval(fetchPrice, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    AudioEngine.sfx.newRound();
                    setRound(r => r + 1);
                    setPricePath(Array(40).fill(10));
                    setStartPrice(livePrice);
                    return 60;
                }
                if (prev <= 10) AudioEngine.sfx.urgent();
                return prev - 1;
            });
            setPricePath(prev => {
                const newPath = [...prev.slice(1)];
                let nextY = 10;
                if (startPrice && livePrice) {
                    const delta = Math.abs(livePrice - startPrice);
                    nextY = (delta / 0.033) * 90 + (Math.random() - 0.5) * 5;
                }
                return [...newPath, Math.min(Math.max(nextY, 5), 100)];
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [round, livePrice, startPrice]);

    const placeBet = async () => {
        if (!tonConnectUI || !walletAddress) return;
        AudioEngine.sfx.lock();
        setIsBetting(true);
        try {
            const buffer = new ArrayBuffer(9);
            const view = new DataView(buffer);
            view.setUint32(0, 4, false);
            view.setUint32(4, round, false);
            view.setUint8(8, selectedSide === 'LONG' ? 1 : 0);
            const payload = btoa(String.fromCharCode(...new Uint8Array(buffer)));

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 300,
                messages: [{ address: CONTRACT_ADDRESS, amount: (parseFloat(betAmount) * 1e9).toString(), payload }]
            });

            const newEntry = { round, amount: betAmount, side: selectedSide, time: new Date().toLocaleTimeString() };
            const updatedHistory = [newEntry, ...history].slice(0, 10);
            setHistory(updatedHistory);
            localStorage.setItem('bl_history', JSON.stringify(updatedHistory));
        } catch (e) {
            console.error(e);
        } finally { setIsBetting(false); }
    };

    const chartPoints = pricePath.map((y, i) => `${i * (100 / 39)},${100 - y}`).join(' ');

    const navTo = (s) => { AudioEngine.sfx.nav(); setScreen(s); };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="gba-shell w-full max-w-[620px] p-8 sm:p-12 flex flex-col items-center">
                <div className="gba-shoulder left"></div>
                <div className="gba-shoulder right"></div>

                <div className="w-full flex justify-center items-center mb-8 relative">
                     <div className="absolute left-0 flex gap-2">
                        <div className="w-2 h-4 bg-indigo-900/50 rounded-sm"></div>
                        <div className="w-2 h-4 bg-indigo-900/50 rounded-sm"></div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="pwr-led"></div>
                        <span className="text-[8px] text-indigo-300 font-bold tracking-[0.2em]" style={{fontFamily: "'Press Start 2P'"}}>POWER</span>
                     </div>
                     <div className="absolute right-0 flex gap-2">
                        <div className="w-2 h-4 bg-indigo-900/50 rounded-sm"></div>
                        <div className="w-2 h-4 bg-indigo-900/50 rounded-sm"></div>
                     </div>
                </div>

                <div className="gba-screen-bezel w-full p-4 mb-10">
                    <div className="flex justify-center mb-3">
                        <span className="text-[7px] text-gray-600 tracking-[0.5em] uppercase font-bold" style={{fontFamily: "'Press Start 2P'"}}>▶ BLINDLIQ ADVANCE ◀</span>
                    </div>

                    <div className="gba-screen aspect-[4/3] rounded-sm overflow-hidden border-2 border-black">
                        <div className="scanline"></div>
                        <div className="screen-glare"></div>

                        <div className="absolute inset-0 p-6 flex flex-col justify-between crt-text text-green-400 text-xs">

                            {screen === 'GAME' && (
                                <>
                                    <div className="flex justify-between items-end border-b border-green-900/40 pb-2 mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-green-800 font-bold uppercase tracking-widest">Oracle_Feed</span>
                                            <span className="text-sm font-black tracking-tight">TON_USD_STREAM</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-lg font-bold">{livePrice ? `$${livePrice.toFixed(3)}` : 'OFFLINE'}</span>
                                            <span className="text-[8px] text-green-800 tracking-tighter">RND_ID: {round.toString().padStart(3, '0')}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[7px] text-green-900 uppercase font-black tracking-widest">Risk Level</span>
                                            <span className="text-[10px] text-green-500 italic">150.00x MAX_LEVERAGE</span>
                                        </div>
                                        <span className={`text-5xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pixel-blink' : 'text-green-500'}`}>
                                            :{timeLeft.toString().padStart(2, '0')}
                                        </span>
                                    </div>

                                    <div className="relative w-full flex-1 border-t border-b border-green-900/20 bg-[#020502] mb-4">
                                        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'linear-gradient(var(--crt-green) 1px, transparent 1px), linear-gradient(90deg, var(--crt-green) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                            <polyline points={chartPoints} fill="none" stroke="var(--crt-green)" strokeWidth="1.5" />
                                            <circle cx="100" cy={100 - pricePath[39]} r="1.5" fill="#fff" className="animate-pulse" />
                                        </svg>
                                        {timeLeft <= 15 && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-red-950/20">
                                                <span className="text-red-500 text-[10px] animate-pixel-blink font-black">!! LIQUIDITY LOCK !!</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <button onClick={()=>AudioEngine.sfx.nav() || setSelectedSide('LONG')} className={`flex-1 py-1.5 text-[10px] font-bold border ${selectedSide==='LONG'?'bg-green-500 text-black border-green-400':'border-green-900 text-green-900'}`}>LONG</button>
                                                <button onClick={()=>AudioEngine.sfx.nav() || setSelectedSide('SHORT')} className={`flex-1 py-1.5 text-[10px] font-bold border ${selectedSide==='SHORT'?'bg-red-500 text-black border-red-400':'border-red-900 text-red-900'}`}>SHORT</button>
                                            </div>
                                            <div className="flex border border-green-900/40 bg-black/60 p-1">
                                                <input type="number" value={betAmount} onChange={e=>setAmount(e.target.value)} className="w-full bg-transparent text-green-400 text-xs font-bold outline-none"/>
                                                <span className="text-green-900 text-[8px] font-black px-1">TON</span>
                                            </div>
                                        </div>
                                        <button
                                            disabled={isBetting || !walletAddress || timeLeft < 15}
                                            onClick={placeBet}
                                            className={`flex-1 py-4 text-[10px] font-black border transition-all ${
                                                !walletAddress ? 'border-gray-800 text-gray-700' :
                                                timeLeft < 15 ? 'border-yellow-900 text-yellow-900' :
                                                'border-green-400 text-green-400 hover:bg-green-400 hover:text-black'
                                            }`}
                                        >
                                            {isBetting ? 'BUSY...' : !walletAddress ? 'NO_LINK' : timeLeft < 15 ? 'CLOSED' : 'TRADE'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {screen === 'PROFILE' && (
                                <div className="h-full flex flex-col">
                                    <div className="border-b border-green-900/40 pb-2 mb-4 flex justify-between items-center">
                                        <span className="text-sm font-black tracking-tighter">OPERATOR_PROFILE</span>
                                        <button onClick={()=>navTo('GAME')} className="text-[10px] border border-green-900 px-2">EXIT</button>
                                    </div>
                                    <div className="flex-1 crt-scrollbar overflow-y-auto space-y-4 pr-2">
                                        <div className="bg-green-900/10 p-3 border border-green-900/20">
                                            <span className="text-[8px] block text-green-800 mb-1 tracking-widest">ID_HASH</span>
                                            <span className="text-[9px] break-all opacity-80">{walletAddress || 'UNLINKED'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold border-b border-green-900/30 block mb-2">SESSION_LOGS</span>
                                            {history.length === 0 ? (
                                                <span className="text-[8px] opacity-40">NO RECORDS FOUND...</span>
                                            ) : (
                                                <div className="space-y-2">
                                                    {history.map((h, i) => (
                                                        <div key={i} className="text-[8px] flex justify-between border-l border-green-900 pl-2">
                                                            <span>RND_{h.round} | {h.side}</span>
                                                            <span>{h.amount} TON</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {walletAddress && (
                                        <button
                                            onClick={() => tonConnectUI.disconnect() && navTo('GAME')}
                                            className="mt-4 w-full py-2 border-2 border-red-900 text-red-500 font-bold hover:bg-red-500 hover:text-black transition-all text-[10px]"
                                        >
                                            TERMINATE_SESSION (DISCONNECT)
                                        </button>
                                    )}
                                </div>
                            )}

                            {screen === 'HELP' && (
                                <div className="h-full flex flex-col">
                                    <div className="border-b border-green-900/40 pb-2 mb-4 flex justify-between items-center">
                                        <span className="text-sm font-black tracking-tighter">SYSTEM_MANUAL</span>
                                        <button onClick={()=>navTo('GAME')} className="text-[10px] border border-green-900 px-2">EXIT</button>
                                    </div>
                                    <div className="flex-1 crt-scrollbar overflow-y-auto space-y-4 pr-2 text-[8px] leading-relaxed text-green-500/80">
                                        <section>
                                            <h4 className="text-green-400 font-bold mb-1 uppercase tracking-widest text-[10px]">How to Trade</h4>
                                            <p>Rounds cycle every 60s. Use Start/Select to navigate. 150x leverage means a price move of $0.033 results in 100% PnL move. Liquidity locks at 15s remaining.</p>
                                        </section>
                                        <section>
                                            <h4 className="text-green-400 font-bold mb-1 uppercase tracking-widest text-[10px]">Oracle Data</h4>
                                            <p>Price data is streamed from Decentralized Oracles (CoinGecko Simple Price API). All trades are settled via TON Smart Contract kQBJ..._m.</p>
                                        </section>
                                        <section className="border-t border-red-900/30 pt-2">
                                            <h4 className="text-red-500 font-bold mb-1 uppercase tracking-widest text-[10px]">Liability Statement</h4>
                                            <p className="text-red-600 font-bold italic">CAUTION: HIGH LEVERAGE TRADING IS EXTREMELY RISKY. 150X MULTIPLIER CAN RESULT IN INSTANT CAPITAL LOSS.</p>
                                            <p className="mt-1">By accessing this interface, you acknowledge that BLIND LIQ™ and its developers are NOT liable for any financial losses, smart contract failures, or oracle inaccuracies. This is an experimental high-leverage protocol.</p>
                                        </section>
                                        <section className="text-[6px] opacity-40 uppercase">
                                            Build_v1.0.4 | Secure_Channel_Established | End_of_Line
                                        </section>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                <div className="w-full flex justify-between items-center px-4">
                     <div className="gba-dpad">
                        <div className="gba-dpad-part gba-dpad-v"></div>
                        <div className="gba-dpad-part gba-dpad-h"></div>
                        <div className="gba-dpad-center"></div>
                     </div>

                     <div className="flex flex-col items-center gap-6">
                        <div className="flex gap-6">
                            <div className="flex flex-col items-center gap-1 rubber-btn" onClick={()=>navTo('HELP')}>
                                <div className="w-10 h-3 bg-black/40 rounded-full rotate-[-20deg] border-b border-white/5 shadow-inner"></div>
                                <span className="text-[6px] text-indigo-900 font-bold uppercase" style={{fontFamily: "'Press Start 2P'"}}>Select</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 rubber-btn" onClick={()=>navTo('PROFILE')}>
                                <div className="w-10 h-3 bg-black/40 rounded-full rotate-[-20deg] border-b border-white/5 shadow-inner"></div>
                                <span className="text-[6px] text-indigo-900 font-bold uppercase" style={{fontFamily: "'Press Start 2P'"}}>Start</span>
                            </div>
                        </div>
                     </div>

                     <div className="gba-btn-group">
                        <button className="gba-btn btn-b" onClick={()=>navTo('GAME')}>B</button>
                        <button className="gba-btn btn-a" onClick={()=>screen === 'GAME' ? placeBet() : navTo('GAME')}>A</button>
                     </div>
                </div>

                <div className="mt-12 w-full flex justify-between items-end px-4">
                    <div className="gba-speaker">
                        {[...Array(12)].map((_, i) => <div key={i} className="speaker-hole"></div>)}
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[12px] text-indigo-900 font-black italic tracking-tighter" style={{fontFamily: "'Press Start 2P'"}}>BLIND LIQ™</span>
                        <span className="text-[7px] text-indigo-800 font-bold tracking-widest">ADVANCE SP</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
