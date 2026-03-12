import React from 'react';
import { JobCategories } from '../types';
import categories from '../data/categories.json';

const HomePage: React.FC = () => {
  return (
    <div>
      <h1>Welcome to GigHub</h1>
      <h2>Job Categories</h2>
      <ul>
        {categories.jobCategories.map(category => (
          <li key={category.id}>
            <span>{category.icon}</span> {category.name}
            <ul>
              {category.subcategories.map(subcategory => (
                <li key={subcategory}>{subcategory}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HomePage;