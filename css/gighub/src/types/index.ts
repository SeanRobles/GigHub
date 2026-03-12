export interface JobCategory {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
}

export interface CategoriesData {
  jobCategories: JobCategory[];
}