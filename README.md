# NewsMap Globe

An interactive 3D globe visualization that displays real-time news events from around the world, with location-based markers determined by AI analysis.

## Demo

https://github.com/user-attachments/assets/1412a6bc-2a8e-472c-89a7-f3a79e29f88b

## Features

- Interactive 3D globe using Three.js
- Real-time news fetching from NewsAPI
- AI-powered location analysis using Claude
- Interactive news markers with hover and click functionality
- Customizable news sources and categories
- Rotation controls and animation
- Detailed logging system

## Prerequisites

- Node.js and npm installed
- API keys for:
  - Anthropic (Claude AI)
  - NewsAPI

## Setup

1. Clone the repository

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your API keys:
```
ANTHROPIC_API_KEY=your_claude_api_key
NEWSAPI_API_KEY=your_newsapi_key
```

4. Start the server:
```bash
node server.js
```

5. Open `index.html` in a web browser

## Usage

1. Select your news source:
   - Top Headlines: Filter by category and country
   - Everything: Choose from specific news sources

2. Set the number of news items to display (1-20)

3. Click "Fetch News" to update the globe

4. Interact with the globe:
   - Click and drag to rotate
   - Hover over markers to highlight them
   - Click markers to view article details
   - Use the slider or pause button to control rotation

## Technical Details

### Frontend
- Three.js for 3D globe rendering
- Custom marker system for news locations
- Interactive UI with real-time updates

### Backend
- Express.js server
- Integration with Claude AI for location analysis
- NewsAPI integration for real-time news data

### API Endpoints

- `/ask-claude`: POST endpoint for AI location analysis
- `/api/news`: GET endpoint for fetching news data

## Controls

- **Fetch News**: Manually update news markers
- **Pause Fetch**: Stop automatic news updates
- **Pause rotation**: Stop globe animation
- **Rotation slider**: Manually control globe rotation
- **News Amount**: Control number of displayed markers (1-20)

## Error Handling

- Comprehensive error logging system
- Graceful handling of API failures
- User feedback through logging interface

## Limitations

- NewsAPI rate limits apply
- Location analysis depends on Claude AI availability
- Maximum of 20 simultaneous news markers

## Browser Compatibility

Requires a modern browser with WebGL support for Three.js functionality.
