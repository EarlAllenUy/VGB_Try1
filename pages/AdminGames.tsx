import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchGames, addGame, deleteGame } from '../services/dataService';
import { Game } from '../types';

const AdminGames: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [dbGames, setDbGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'manage' | 'import'>('manage');

  // IGDB Auth State
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [importResults, setImportResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Staging State (Game being edited before add)
  const [stagedGame, setStagedGame] = useState<Game | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
        navigate('/');
        return;
    }
    loadDbGames();
  }, [user, navigate]);

  const loadDbGames = async () => {
      setLoading(true);
      try {
          const games = await fetchGames();
          setDbGames(games);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleIgdbSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!clientId || !clientSecret) {
          alert("Please enter both Client ID and Client Secret.");
          return;
      }
      setSearching(true);
      try {
          // Call our local server proxy to handle IGDB Auth & CORS
          const res = await fetch(`http://localhost:3001/igdb/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  clientId,
                  clientSecret,
                  query: searchTerm
              })
          });
          
          const data = await res.json();
          if (res.ok) {
            setImportResults(data || []);
          } else {
            alert("Search failed: " + (data.error || "Unknown error"));
          }
      } catch (error) {
          console.error("IGDB Proxy Error", error);
          alert("Failed to connect to server.");
      } finally {
          setSearching(false);
      }
  };

  const stageForImport = (igdbGame: any) => {
      // Logic to parse unix timestamp
      let dateStr = 'TBA';
      if (igdbGame.first_release_date) {
          const d = new Date(igdbGame.first_release_date * 1000);
          dateStr = d.toISOString().split('T')[0];
      }

      // Logic to build Image URL
      // IGDB format: https://images.igdb.com/igdb/image/upload/t_{size}/{hash}.jpg
      let imgUrl = '';
      if (igdbGame.cover && igdbGame.cover.image_id) {
          imgUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${igdbGame.cover.image_id}.jpg`;
      }

      // Safe access for nested arrays
      const developer = igdbGame.involved_companies?.[0]?.company?.name || 'Unknown';
      const platforms = igdbGame.platforms?.map((p: any) => p.name) || [];
      const genre = igdbGame.genres?.[0]?.name || 'Action';

      const newGame: Game = {
          title: igdbGame.name,
          releaseDate: dateStr,
          developer: developer,
          publisher: 'Unknown', // IGDB structure for publisher is complex, simpler to edit manually
          status: dateStr === 'TBA' ? 'TBA' : (new Date(dateStr) > new Date() ? 'Upcoming' : 'Released'),
          platforms: platforms,
          genre: genre,
          description: igdbGame.summary || "Imported from IGDB.",
          imageUrl: imgUrl
      };
      setStagedGame(newGame);
  };

  const saveStagedGame = async () => {
      if (!stagedGame) return;
      
      const success = await addGame(stagedGame);
      if (success) {
          alert("Game imported successfully!");
          setStagedGame(null);
          loadDbGames(); // Refresh list
          setActiveTab('manage');
      } else {
          alert("Failed to save game to database.");
      }
  };

  const handleDeleteDbGame = async (id: string) => {
      if (!confirm("Delete this game permanently?")) return;
      const success = await deleteGame(id);
      if (success) {
          setDbGames(prev => prev.filter(g => g.id !== id));
      } else {
          alert("Could not delete game. Is the server running?");
      }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
        <div className="flex items-center gap-4 mb-2">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-bold">
                ← Back
            </button>
        </div>

        <div className="bg-vgb-card p-6 rounded-xl border-l-4 border-vgb-accent shadow-lg flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-white mb-1">Admin Game Manager</h1>
                <p className="text-gray-400">Import from IGDB (Twitch) or manage existing listings.</p>
            </div>
            <div className="flex bg-zinc-900 rounded-lg p-1 gap-1">
                <button 
                    onClick={() => setActiveTab('manage')}
                    className={`px-4 py-2 rounded text-sm font-bold transition-colors ${activeTab === 'manage' ? 'bg-zinc-700 text-white' : 'text-gray-500 hover:text-white'}`}
                >
                    Database ({dbGames.length})
                </button>
                <button 
                    onClick={() => setActiveTab('import')}
                    className={`px-4 py-2 rounded text-sm font-bold transition-colors ${activeTab === 'import' ? 'bg-vgb-accent text-black' : 'text-gray-500 hover:text-white'}`}
                >
                    Import Games
                </button>
            </div>
        </div>

        {/* IMPORT TAB */}
        {activeTab === 'import' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Search Column */}
                <div className="space-y-6">
                    <div className="bg-vgb-card p-6 rounded-xl border border-zinc-800">
                        <h2 className="text-xl font-bold text-white mb-4">1. IGDB Search</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Client ID</label>
                                    <input 
                                        type="text" 
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white text-sm"
                                        placeholder="From dev.twitch.tv"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Client Secret</label>
                                    <input 
                                        type="password" 
                                        value={clientSecret}
                                        onChange={(e) => setClientSecret(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white text-sm"
                                        placeholder="From dev.twitch.tv"
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-600">
                                Requires Twitch Developer credentials. <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer" className="text-vgb-accent underline">Get them here.</a>
                            </p>

                            <form onSubmit={handleIgdbSearch} className="flex gap-2 border-t border-zinc-800 pt-4">
                                <input 
                                    type="text" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search for a game..."
                                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                                />
                                <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 rounded transition-colors">
                                    {searching ? '...' : 'Search IGDB'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {importResults.map((result: any) => (
                            <div key={result.id} className="bg-vgb-card border border-zinc-800 rounded-lg overflow-hidden hover:border-vgb-accent/50 transition-colors flex flex-col">
                                <div className="h-32 bg-zinc-800 relative">
                                    {result.cover && result.cover.image_id ? (
                                        <img 
                                            src={`https://images.igdb.com/igdb/image/upload/t_cover_big/${result.cover.image_id}.jpg`} 
                                            alt={result.name} 
                                            className="w-full h-full object-cover opacity-80" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold">No Image</div>
                                    )}
                                </div>
                                <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-white truncate text-sm" title={result.name}>{result.name}</h3>
                                        <p className="text-xs text-gray-500">
                                            {result.first_release_date 
                                                ? new Date(result.first_release_date * 1000).getFullYear() 
                                                : 'TBA'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => stageForImport(result)}
                                        className="mt-3 w-full bg-zinc-700 hover:bg-vgb-accent hover:text-black text-white text-xs font-bold py-2 rounded transition-colors"
                                    >
                                        SELECT
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Staging/Edit Column */}
                <div>
                     <div className={`bg-vgb-card p-6 rounded-xl border-2 sticky top-6 ${stagedGame ? 'border-vgb-accent shadow-lg shadow-vgb-accent/10' : 'border-zinc-800 border-dashed opacity-50'}`}>
                        <h2 className="text-xl font-bold text-white mb-4">2. Edit & Save</h2>
                        {stagedGame ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Title</label>
                                    <input 
                                        value={stagedGame.title} 
                                        onChange={(e) => setStagedGame({...stagedGame, title: e.target.value})}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Release Date</label>
                                        <input 
                                            value={stagedGame.releaseDate} 
                                            onChange={(e) => setStagedGame({...stagedGame, releaseDate: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Status</label>
                                        <select 
                                            value={stagedGame.status} 
                                            onChange={(e) => setStagedGame({...stagedGame, status: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                                        >
                                            <option value="Upcoming">Upcoming</option>
                                            <option value="Released">Released</option>
                                            <option value="TBA">TBA</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Image URL</label>
                                    <div className="flex gap-2">
                                        <input 
                                            value={stagedGame.imageUrl || ''} 
                                            onChange={(e) => setStagedGame({...stagedGame, imageUrl: e.target.value})}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white text-xs font-mono"
                                        />
                                        {stagedGame.imageUrl && <img src={stagedGame.imageUrl} alt="Preview" className="w-10 h-10 object-cover rounded border border-zinc-600" />}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 uppercase font-bold mb-1">Genre</label>
                                    <input 
                                        value={stagedGame.genre || ''} 
                                        onChange={(e) => setStagedGame({...stagedGame, genre: e.target.value})}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-zinc-800">
                                    <button onClick={() => setStagedGame(null)} className="flex-1 py-3 text-sm font-bold text-gray-400 hover:text-white bg-zinc-800 rounded">CANCEL</button>
                                    <button onClick={saveStagedGame} className="flex-1 py-3 text-sm font-bold text-black bg-vgb-accent hover:bg-vgb-accentDark rounded shadow-lg">CONFIRM IMPORT</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-400">Select a game from the left to edit here.</p>
                            </div>
                        )}
                     </div>
                </div>
            </div>
        )}

        {/* MANAGE TAB */}
        {activeTab === 'manage' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {loading ? <div className="text-white">Loading...</div> : dbGames.map(game => (
                    <div key={game.id} className="bg-vgb-card border border-zinc-800 rounded-xl overflow-hidden group">
                        <div className="h-40 bg-zinc-800 relative">
                             {game.imageUrl ? (
                                 <img src={game.imageUrl} alt={game.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-zinc-700">{game.title.charAt(0)}</div>
                             )}
                             <div className="absolute top-2 right-2">
                                <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${game.status === 'Released' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                                    {game.status}
                                </span>
                             </div>
                        </div>
                        <div className="p-4">
                            <h3 className="font-bold text-white text-lg truncate mb-1">{game.title}</h3>
                            <p className="text-xs text-gray-500 mb-4">{game.releaseDate} · {game.developer}</p>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleDeleteDbGame(game.id!)}
                                    className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-500 text-xs font-bold py-2 rounded border border-red-900/50 transition-colors"
                                >
                                    DELETE
                                </button>
                                {/* Edit functionality would act similarly to Import Staging */}
                                <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold py-2 rounded transition-colors">
                                    EDIT
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default AdminGames;