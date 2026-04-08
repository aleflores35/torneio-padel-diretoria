import React, { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';

interface CategoryContextType {
  selectedCategory: number | null;
  setSelectedCategory: (category: number | null) => void;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  return (
    <CategoryContext.Provider value={{ selectedCategory, setSelectedCategory }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory deve ser usado dentro de CategoryProvider');
  }
  return context;
};
