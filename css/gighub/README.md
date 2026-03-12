# Gighub Project

## Overview
Gighub is a web application designed to connect freelancers with job opportunities across various categories. This project is built using TypeScript and follows a modular architecture for easy maintenance and scalability.

## Project Structure
```
gighub
├── src
│   ├── app.ts                # Entry point of the application
│   ├── components            # Contains reusable components
│   │   └── index.ts
│   ├── pages                 # Contains page components
│   │   └── index.ts
│   ├── data                  # Contains data files
│   │   └── categories.json
│   └── types                 # Contains TypeScript types and interfaces
│       └── index.ts
├── public                    # Contains static assets
│   ├── _redirects            # Netlify redirects configuration
│   └── 404.html              # Custom 404 error page
├── netlify.toml              # Netlify configuration file
├── package.json              # npm configuration file
├── tsconfig.json             # TypeScript configuration file
└── README.md                 # Project documentation
```

## Getting Started
To get started with the Gighub project, follow these steps:

1. **Clone the repository**
   ```
   git clone <repository-url>
   cd gighub
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Build the project**
   ```
   npm run build
   ```

4. **Run the application locally**
   ```
   npm start
   ```

## Deployment
This project is configured for deployment on Netlify. Ensure that the following configurations are in place:

- The `public` directory contains all static assets needed for the application.
- The `netlify.toml` file includes the necessary build commands and publish directory settings.
- A `404.html` file is present in the `public` directory to handle 404 errors gracefully.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.