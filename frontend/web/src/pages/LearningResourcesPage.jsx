/**
 * LearningResourcesPage.jsx — Topic-aligned learning resources
 *
 * Maps to PRD §9.26 Learning Resources & Improvement Support.
 * Features:
 *   • Category filter tabs
 *   • Resource cards with category, difficulty, title, description, CTA
 *
 * TODO: Replace mock data with fetchResources()
 */
import React, { useState, useEffect } from 'react';
import { fetchResources } from '../services/mockApi';
import ResourceCard from '../components/ResourceCard';
import LoadingState from '../components/LoadingState';

export default function LearningResourcesPage() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    fetchResources()
      .then(setResources)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...new Set(resources.map((r) => r.category))];

  const filtered =
    activeCategory === 'All'
      ? resources
      : resources.filter((r) => r.category === activeCategory);

  if (loading) return <LoadingState message="Loading resources..." />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="mb-2">Learning Resources</h1>
      <p className="text-ink-500 mb-8">
        Explore curated materials to strengthen your weak areas and sharpen
        interview skills.
      </p>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeCategory === cat
                ? 'bg-primary-500 text-white'
                : 'text-ink-700 bg-white border border-surface-200 hover:border-primary-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Resource Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </div>
  );
}
