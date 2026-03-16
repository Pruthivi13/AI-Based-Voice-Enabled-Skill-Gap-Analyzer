/**
 * ResourceCard.jsx — Learning resource card
 *
 * Props:
 *   resource — { title, description, category, difficulty, url }
 */
import React from 'react';

const difficultyColors = {
  Beginner:     'bg-green-100 text-green-700',
  Intermediate: 'bg-amber-100 text-amber-700',
  Advanced:     'bg-red-100 text-red-700',
};

export default function ResourceCard({ resource }) {
  return (
    <div className="card hover-lift flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="chip bg-primary-50 text-primary-600">{resource.category}</span>
          <span className={`chip ${difficultyColors[resource.difficulty] || ''}`}>
            {resource.difficulty}
          </span>
        </div>
        <h4 className="font-bold text-ink-900 mb-2">{resource.title}</h4>
        <p className="text-sm text-ink-700 leading-relaxed">{resource.description}</p>
      </div>
      <a
        href={resource.url}
        className="mt-4 btn-primary text-sm py-2 text-center"
        target="_blank"
        rel="noopener noreferrer"
      >
        Learn More →
      </a>
    </div>
  );
}
