import React, { useEffect, useState } from 'react';
import { fetchGames, fetchReviews, fetchNews } from '../services/dataService';
import { Game, Review, NewsItem } from '../types';
import { useAuth } from '../context/AuthContext';

// Helper type for display
interface GameWithRating extends Game {
  avgRating?: number;
  reviewCount?: number;
}

const Home: React.FC = () => {
  const { user } = useAuth();
  const [featuredGames, setFeaturedGames] = useState<GameWithRating[]>([]);
  const [anticipatedGames, setAnticipatedGames] = useState<GameWithRating[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'featured' | 'anticipated'>('featured');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [gamesData, reviewsData, newsData] = await Promise.all([
          fetchGames(), 
          fetchReviews(),
          fetchNews()
        ]);
        
        setNews(newsData);

        // 1. Process Featured (Use more games to fill wider screens)
        setFeaturedGames(gamesData.slice(0, 8));

        // 2. Process Anticipated (Based on Ratings)
        // Create a map of Title -> Ratings[]
        const ratingsMap: Record<string, number[]> = {};
        reviewsData.forEach((r: Review) => {
          if (!ratingsMap[r.gameTitle]) {
            ratingsMap[r.gameTitle] = [];
          }
          ratingsMap[r.gameTitle].push(r.rating);
        });

        // Calculate averages and attach to games
        const gamesWithScores: GameWithRating[] = gamesData.map(game => {
          const ratings = ratingsMap[game.title] || [];
          const total = ratings.reduce((acc, curr) => acc + curr, 0);
          const avg = ratings.length > 0 ? total / ratings.length : 0;
          return {
            ...game,
            avgRating: avg,
            reviewCount: ratings.length
          };
        });

        // Sort by Average Rating Descending, then by Review Count
        const sortedByRating = gamesWithScores
          .filter(g => (g.reviewCount || 0) > 0) // Only show games that actually have reviews/hype
          .sort((a, b) => {
            if ((b.avgRating || 0) !== (a.avgRating || 0)) {
              return (b.avgRating || 0) - (a.avgRating || 0);
            }
            return (b.reviewCount || 0) - (a.reviewCount || 0);
          });

        // If no games have reviews yet, fallback to showing all games sorted by ID or another metric
        const finalAnticipated = sortedByRating.length > 0 ? sortedByRating : gamesWithScores.slice(0, 8);

        setAnticipatedGames(finalAnticipated.slice(0, 8));

      } catch (error) {
        console.error("Failed to load home data", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      alert(`Thanks for subscribing! News will be sent to ${email}`);
      setEmail('');
    }
  };

  const displayGames = activeTab === 'featured' ? featuredGames : anticipatedGames;

  // Helper to format twitter-style numbers
  const formatMetric = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <div className="space-y-8 animate-fade-in w-full">
      {/* Welcome Banner */}
      <section className="bg-gradient-to-r from-blue-900 to-vgb-card p-8 rounded-xl border-l-4 border-vgb-accent shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-2">
          {user ? `Welcome back, ${user.username}!` : 'Welcome to Video Game Bulletin'}
        </h1>
        <p className="text-gray-300">
          {user?.role === 'admin' 
            ? 'Manage content, users, and reviews from your dashboard.' 
            : 'Your one-stop destination for the latest gaming news, release dates, and community reviews.'}
        </p>
      </section>

      {/* Main Grid Layout: Scales to 4 columns on XL screens for games, 1 col for news */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Main Content Area (Games) - Takes 3 columns on large screens */}
        <div className="xl:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex bg-zinc-900 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveTab('featured')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 ${
                    activeTab === 'featured' 
                      ? 'bg-vgb-accent text-black shadow-lg scale-105' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  FEATURED
                </button>
                <button 
                  onClick={() => setActiveTab('anticipated')}
                  className={`px-4 py-2 rounded-md text-sm font-bold transition-all duration-300 ${
                    activeTab === 'anticipated' 
                      ? 'bg-vgb-accent text-black shadow-lg scale-105' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  MOST ANTICIPATED
                </button>
              </div>
              
              <span className="text-xs text-vgb-accent font-bold uppercase tracking-wider hidden sm:block">
                {activeTab === 'featured' ? 'Editors Picks' : 'Community Rated'}
              </span>
          </div>

          {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {[1,2,3,4].map(i => (
                      <div key={i} className="h-48 bg-zinc-800 rounded-xl animate-pulse"></div>
                  ))}
              </div>
          ) : (
              // Inner Grid: Scales from 1 to 4 columns based on screen width
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 animate-fade-in">
              {displayGames.map((game) => (
                  <div key={game.id} className="group bg-vgb-card p-5 rounded-xl border border-zinc-800 hover:border-vgb-accent/50 hover:shadow-lg hover:shadow-vgb-accent/10 transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                          <h3 className="text-xl font-bold text-white group-hover:text-vgb-accent transition-colors truncate pr-2" title={game.title}>
                          {game.title}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded font-bold uppercase shrink-0 ${
                              game.status === 'Released' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                          }`}>
                          {game.status || 'TBA'}
                          </span>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-400">
                          <p><span className="text-gray-500">Dev:</span> {game.developer || 'Unknown'}</p>
                          <p><span className="text-gray-500">Release:</span> {game.releaseDate}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                          {game.platforms?.map(p => (
                              <span key={p} className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-gray-300">{p}</span>
                          ))}
                          </div>
                      </div>
                    </div>

                    {/* Rating Section - Only visible on Anticipated Tab or if data exists */}
                    {activeTab === 'anticipated' && (
                      <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400 text-lg">★</span>
                          <span className="font-bold text-white text-lg">{(game.avgRating || 0).toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {game.reviewCount} Reviews
                        </span>
                      </div>
                    )}
                  </div>
              ))}
              </div>
          )}
        </div>

        {/* Sidebar (Right Column) - News & Newsletter - Takes 1 column on large screens */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* News Feed */}
          <div className="bg-vgb-card rounded-xl border border-zinc-800 overflow-hidden flex flex-col h-[500px]">
             <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  LATEST NEWS
                </h2>
                <span className="text-xs text-gray-500">Live Feed</span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {loading ? (
                  <p className="text-gray-500 text-center text-sm">Loading feed...</p>
                ) : (
                  news.map(item => (
                    <div key={item.id} className="border-b border-zinc-800/50 pb-4 last:border-0 last:pb-0">
                       <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-xs text-gray-300 shrink-0">
                             {item.avatar}
                          </div>
                          <div>
                             <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-bold text-sm text-white hover:underline cursor-pointer">{item.author}</span>
                                <span className="text-xs text-gray-500">{item.handle}</span>
                                <span className="text-xs text-gray-600">· {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                             </div>
                             <p className="text-sm text-gray-300 mt-1 leading-snug">
                                {item.content}
                             </p>
                             <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1 hover:text-green-400 cursor-pointer">
                                  <span>↺</span> {formatMetric(item.retweets)}
                                </span>
                                <span className="flex items-center gap-1 hover:text-red-400 cursor-pointer">
                                  <span>♥</span> {formatMetric(item.likes)}
                                </span>
                             </div>
                          </div>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>

          {/* Newsletter Box */}
          <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-xl p-5 border border-zinc-700 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-2">The VGB Newsletter</h3>
            <p className="text-sm text-gray-400 mb-4">Get the latest game releases and exclusive reviews delivered straight to your inbox.</p>
            <form onSubmit={handleSubscribe} className="space-y-3">
              <input 
                type="email" 
                placeholder="your@email.com" 
                className="w-full bg-black/30 border border-zinc-600 rounded px-3 py-2 text-white text-sm focus:border-vgb-accent focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="w-full bg-vgb-accent hover:bg-vgb-accentDark text-black font-bold py-2 rounded text-sm transition-colors uppercase tracking-wide">
                Subscribe
              </button>
            </form>
          </div>

        </div>
      </div>

      <section className="text-center pt-8 border-t border-zinc-800">
        <p className="text-xl italic text-gray-500 font-serif">
          "Your ultimate source for everything gaming."
        </p>
      </section>
    </div>
  );
};

export default Home;