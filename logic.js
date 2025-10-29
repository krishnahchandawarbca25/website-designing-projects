// Note: This script assumes that 'marked' and 'THREE' are available globally
// as they are loaded via <script> tags in index.html.

// --- 1. CONFIGURATION ---

// --- Gemini API Config ---
// THIS WILL BE BLOCKED BY THE BROWSER'S SECURITY POLICY (CSP)
// This is the cause of the PERMISSION_DENIED error.
const GEMINI_API_KEY = "AIzaSyAuLrMiP1cDuX97jNJdiuduuJLx4_ZGT18"; // Key has been added
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// --- GNews API Config ---
const GNEWS_API_KEY = "10273e52cf9fa3431183b9cd2bd53da8";

// --- Wikipedia API Config ---
const WIKI_API_URL = "https://en.wikipedia.org/w/api.php";

// --- APP STATE ---
let wikiHistory = []; // For the new back button

// --- Mock Data (Fallback for News) ---
const mockNewsData = {
    "totalArticles": 4,
    "articles": [
        {
            "title": "Mock: The Future of Quantum Computing",
            "description": "Quantum computers promise to revolutionize... (This is mock data as GNews API is blocked)",
            "content": "...",
            "url": "https://en.wikipedia.org/wiki/Quantum_computing",
            "image": "https://placehold.co/600x400/2a2a4e/8a4fff?text=Quantum",
            "publishedAt": "2025-10-28T10:00:00Z",
            "source": { "name": "Mock Data Service", "url": "https://google.com/news" }
        },
        {
            "title": "Mock: Breakthrough in AI-Powered Drug Discovery",
            "description": "New AI models are accelerating the discovery of novel treatments...",
            "content": "...",
            "url": "https://en.wikipedia.org/wiki/Artificial_intelligence",
            "image": "https://placehold.co/600x400/2a2a4e/ff4f8a?text=AI+Discovery",
            "publishedAt": "2025-10-28T09:00:00Z",
            "source": { "name": "Mock Data Service", "url": "https://google.com/news" }
        },
        {
            "title": "Mock: Mars Colony Simulators Go Online",
            "description": "Simulations are preparing for the next giant leap in space exploration...",
            "content": "...",
            "url": "https://en.wikipedia.org/wiki/Mars",
            "image": "https://placehold.co/600x400/2a2a4e/4fafff?text=Mars+Sim",
            "publishedAt": "2025-10-28T08:00:00Z",
            "source": { "name": "Mock Data Service", "url": "https://google.com/news" }
        },
        {
            "title": "Mock: Deep Sea Vents Reveal New Life",
            "description": "Scientists are stunned by the biodiversity found...",
            "content": "...",
            "url": "https://en.wikipedia.org/wiki/Hydrothermal_vent",
            "image": "https://placehold.co/600x400/2a2a4e/4fff8a?text=Deep+Sea",
            "publishedAt": "2025-10-28T07:00:00Z",
            "source": { "name": "Mock Data Service", "url": "https://google.com/news" }
        }
    ]
};

// --- 2. DOM SELECTORS ---
const searchInput = document.getElementById('search-input');
const searchWikiBtn = document.getElementById('search-wiki-btn');
const searchAiBtn = document.getElementById('search-ai-btn');
const newsFeed = document.getElementById('news-feed');
const newsFilterMenu = document.getElementById('news-filter-menu');

// Search Results Modal Selectors
const searchModal = document.getElementById('search-results-modal');
const searchModalTitle = document.getElementById('search-results-title');
const searchResultsList = document.getElementById('search-results-list');
const searchResultsLoader = document.getElementById('search-results-loader');
const closeSearchModalBtn = document.getElementById('close-search-results');

// Article Reader Modal Selectors
const articleModal = document.getElementById('article-reader-modal');
const articleModalTitle = document.getElementById('article-reader-title');
const articleModalContent = document.getElementById('article-reader-content');
const articleLoader = document.getElementById('article-loader');
const articleBackBtn = document.getElementById('article-back-btn'); // NEW Back button
const backToSearchBtn = document.getElementById('back-to-search');
const closeArticleModalBtn = document.getElementById('close-article-reader');

// AI Helper Modal Selectors
const aiHelperModal = document.getElementById('ai-helper-modal');
const closeAiHelperBtn = document.getElementById('close-ai-helper');
const aiQueryForm = document.getElementById('ai-query-form');
const aiQueryInput = document.getElementById('ai-query-input');
const aiResponseArea = document.getElementById('ai-response-area');
const aiLoader = document.getElementById('ai-loader');

// --- 3. WIKIPEDIA API FUNCTIONS ---

async function fetchWikipediaSearch(query) {
    const params = new URLSearchParams({
        action: "opensearch",
        search: query,
        limit: "10",
        namespace: "0",
        format: "json",
        origin: "*"
    });
    try {
        const response = await fetch(`${WIKI_API_URL}?${params}`);
        if (!response.ok) throw new Error("Network response was not ok.");
        const data = await response.json();
        renderSearchResults(data[1], data[2], data[3]);
    } catch (error) {
        console.error("Error fetching Wikipedia search:", error);
        searchResultsList.innerHTML = `<p class="p-4 text-red-400">Error: Could not fetch search results.</p>`;
    }
}

/**
 * Fetches and displays a Wikipedia article.
 * @param {string} pageTitle - The title of the Wikipedia page.
 * @param {boolean} [isBack=false] - True if this is a "back" navigation.
 */
async function fetchWikipediaArticle(pageTitle, isBack = false) {
    if (!isBack) {
        wikiHistory.push(pageTitle);
    }
    updateArticleNavButtons();

    toggleSearchModal(false);
    toggleArticleModal(true);
    articleLoader.style.display = 'block';
    articleModalContent.innerHTML = '';
    articleModalContent.appendChild(articleLoader);
    articleModalTitle.textContent = pageTitle;
    articleModalContent.scrollTop = 0; // Scroll to top

    const params = new URLSearchParams({
        action: "parse",
        page: pageTitle,
        format: "json",
        prop: "text|images",
        disabletoc: "true",
        origin: "*"
    });
    try {
        const response = await fetch(`${WIKI_API_URL}?${params}`);
        if (!response.ok) throw new Error("Network response was not ok.");
        const data = await response.json();
        if (data.error) throw new Error(data.error.info);
        renderFullArticle(data.parse.text["*"], pageTitle);
    } catch (error) {
        console.error("Error fetching Wikipedia article:", error);
        articleModalContent.innerHTML = `<p class="p-4 text-red-400">Error: Could not load article. ${error.message}</p>`;
    }
}

function renderSearchResults(titles, descriptions, urls) {
    searchResultsLoader.style.display = 'none';
    searchResultsList.innerHTML = "";
    if (titles.length === 0) {
        searchResultsList.innerHTML = `<p class="p-4 text-center">No results found.</p>`;
        return;
    }
    titles.forEach((title, index) => {
        const item = document.createElement('a');
        item.className = "search-result-item";
        item.innerHTML = `<h4>${title}</h4><p>${descriptions[index]}</p>`;
        // When clicking from search, reset history
        item.addEventListener('click', () => {
            wikiHistory = []; // Reset history for a new search
            fetchWikipediaArticle(title, false);
        });
        searchResultsList.appendChild(item);
    });
}

function renderFullArticle(html, pageTitle) {
    articleLoader.style.display = 'none';
    articleModalContent.innerHTML = html;
    const content = articleModalContent;
    // Clean up unwanted Wikipedia elements
    content.querySelectorAll('.mw-editsection, .reflist, .reference, .references, .mbox-small, .noprint, .mw-selflink-نوان, table.navbox').forEach(el => el.remove());
    
    // Handle links
    content.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href) {
            if (href.startsWith('/wiki/')) {
                // This is an internal Wikipedia link
                a.setAttribute('href', `https://en.wikipedia.org${href}`); // Set real href for new tab
                a.setAttribute('target', '_blank'); // Open in new tab by default
                
                // Check if it's a valid article link (not a file, category, etc.)
                if (!href.includes(':')) {
                    a.classList.add('internal-link');
                    a.dataset.pageTitle = decodeURIComponent(href.replace('/wiki/', ''));
                    a.addEventListener('click', handleInternalLinkClick); // Add our custom click handler
                }
            } else if (href.startsWith('#')) {
                // Internal anchor link, let it be
            } else {
                // External link
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
            }
        }
    });

    // Fix image source URLs
    content.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
            if (src.startsWith('//')) {
                img.src = `https:${src}`; // Fix protocol-relative URLs
            } else if (src.startsWith('/')) {
                img.src = `https://en.wikipedia.org${src}`; // Fix root-relative URLs
            }
        }
    });
}

function handleInternalLinkClick(e) {
    e.preventDefault(); // Stop it from opening a new tab
    const pageTitle = e.currentTarget.dataset.pageTitle;
    if (pageTitle) {
        articleModalContent.scrollTop = 0;
        fetchWikipediaArticle(pageTitle, false); // Add to history
    }
}

// NEW function to handle back button click
function handleArticleBack() {
    if (wikiHistory.length > 1) {
        wikiHistory.pop(); // Remove the current page
        const previousPage = wikiHistory[wikiHistory.length - 1]; // Get the new last page
        articleModalContent.scrollTop = 0;
        fetchWikipediaArticle(previousPage, true); // Fetch it as a "back" navigation
    }
}

// NEW function to show/hide back button
function updateArticleNavButtons() {
    if (wikiHistory.length > 1) {
        articleBackBtn.style.display = 'block';
    } else {
        articleBackBtn.style.display = 'none';
    }
}

// --- 4. NEWS FEED FUNCTIONS ---

async function loadNewsFeed(topic = "breaking-news") {
    newsFeed.innerHTML = `
        <div class="article-card-skeleton animate-pulse"></div>
        <div class="article-card-skeleton animate-pulse"></div>
        <div class="article-card-skeleton animate-pulse hidden md:block"></div>
    `;
    const url = `https://gnews.io/api/v4/top-headlines?category=general&topic=${topic}&lang=en&max=6&apikey=${GNEWS_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`GNews API error: ${response.status}`);
        const data = await response.json();
        renderNewsFeed(data.articles);
    } catch (error) {
        console.warn(`Live News Feed Failed: ${error.message}. This is expected in some environments. Displaying mock data.`);
        renderNewsFeed(mockNewsData.articles);
    }
}

function renderNewsFeed(articles) {
    newsFeed.innerHTML = "";
    if (!articles || articles.length === 0) {
        newsFeed.innerHTML = "<p>No articles found for this topic.</p>";
        return;
    }
    articles.forEach(article => {
        const card = document.createElement('article');
        // FIX: Removed 'fade-in-section' from here to prevent vanishing
        card.className = "article-card rounded-lg overflow-hidden shadow-lg p-4"; 
        
        // This is the updated "Image Not Available" logic
        const imageUrl = article.image || `https://placehold.co/600x400/2a2a4e/c0c0ff?text=Image+Not+Available`;
        
        card.innerHTML = `
            <a href="${article.url}" target="_blank" rel="noopener noreferrer">
                <img src="${imageUrl}" alt="${article.title}" class="w-full h-48 object-cover rounded-md mb-4" onerror="this.src='https://placehold.co/600x400/2a2a4e/c0c0ff?text=Image+Not+Available'">
                <h3 class="text-xl font-bold mb-2 text-white hover:text-indigo-400 transition-colors">${article.title}</h3>
            </a>
            <p class="text-gray-400 text-sm mb-3">${article.description}</p>
            <div class="text-xs text-gray-500">
                <span>${article.source.name}</span> |
                <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
            </div>
        `;
        newsFeed.appendChild(card);
    });
}

// --- 5. AI CHAT FUNCTIONS (NEW) ---

/**
 * Handles the "Ask AI" form submission.
 * This will attempt to call the Gemini API and will likely fail.
 * @param {Event} e - The form submission event.
 */
async function handleAiSubmit(e) {
    e.preventDefault();
    const query = aiQueryInput.value.trim();
    if (!query) return;

    aiLoader.style.display = 'block';
    aiResponseArea.style.display = 'none';
    aiResponseArea.innerHTML = '';

    try {
        // --- THIS IS THE CALL THAT WILL BE BLOCKED ---
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: query }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            // This will catch the PERMISSION_DENIED error
            throw new Error(errorData.error.message || `API Error: ${response.status}`);
        }

        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        
        // If it somehow succeeds, render the text
        aiLoader.style.display = 'none';
        aiResponseArea.classList.remove('error');
        aiResponseArea.innerHTML = marked.parse(text); // Using markdown parser
        aiResponseArea.style.display = 'block';

    } catch (error) {
        console.error("AI API Call Failed:", error);
        aiLoader.style.display = 'none';
        
        // --- THIS IS THE IMPORTANT PART ---
        // Display a user-facing error explaining the unfixable problem.
        aiResponseArea.classList.add('error');
        aiResponseArea.innerHTML = `
            <h4>API Request Blocked</h4>
            <p><strong>Error:</strong> ${error.message}</p>
            <p>As we've seen, the request to the AI model was blocked by the browser's security policy. This is a security restriction in this environment that we cannot fix.</p>
            <p>Please use the <strong>"Search Facts"</strong> button for Wikipedia, or ask me (Gemini) in the chat on the left!</p>
        `;
        aiResponseArea.style.display = 'block';
    }
}

// --- 6. MODAL & EVENT HANDLERS ---

function toggleSearchModal(show) {
    if (show) searchModal.classList.add('open');
    else searchModal.classList.remove('open');
}

function toggleArticleModal(show) {
    if (show) articleModal.classList.add('open');
    else articleModal.classList.remove('open');
}

function toggleAiHelperModal(show) {
    if (show) aiHelperModal.classList.add('open');
    else aiHelperModal.classList.remove('open');
}

function handleWikiSearch(e) {
    e.preventDefault(); 
    const query = searchInput.value.trim();
    if (!query) return;
    toggleSearchModal(true);
    searchModalTitle.textContent = `Wikipedia Results: ${query}`;
    searchResultsList.innerHTML = '';
    searchResultsList.appendChild(searchResultsLoader);
    searchResultsLoader.style.display = 'block';
    fetchWikipediaSearch(query);
}

function handleAiSearch(e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    aiQueryInput.value = query; // Set the text in the new modal
    aiResponseArea.innerHTML = ''; // Clear old responses
    aiResponseArea.style.display = 'none';
    aiLoader.style.display = 'none';
    toggleAiHelperModal(true);
}

function handleNewsFilterClick(e) {
    if (e.target.classList.contains('news-filter-btn')) {
        document.querySelectorAll('.news-filter-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-indigo-600', 'text-white');
        });
        e.target.classList.add('active', 'bg-indigo-600', 'text-white');
        const topic = e.target.dataset.topic;
        loadNewsFeed(topic);
    }
}

// --- 7. THREE.JS BACKGROUND ---

let scene, camera, renderer, stars;

function init3DBackground() {
    // FIX: Check if THREE is loaded
    if (typeof THREE === 'undefined') {
        console.error("Three.js library is not loaded.");
        return;
    }
    const canvas = document.getElementById('bg-canvas');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background

    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.8
    });

    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;
        starVertices.push(x, y, z);
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('mousemove', onMouseMove, false);
    animate3DBackground();
}

function animate3DBackground() {
    if (!renderer || !scene || !camera || !stars) return; // Add check
    requestAnimationFrame(animate3DBackground);
    stars.rotation.x += 0.0001;
    stars.rotation.y += 0.0002;
    renderer.render(scene, camera);
}

function onWindowResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    if (!camera || !scene) return;
    // Move camera slightly based on mouse
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    camera.position.x = mouseX * 0.5;
    camera.position.y = mouseY * 0.5;
    camera.lookAt(scene.position);
}

// --- 8. SCROLL ANIMATION ---

function initScrollAnimations() {
    const sections = document.querySelectorAll('.fade-in-section');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 }); // Trigger when 10% of the element is visible

    sections.forEach(section => {
        observer.observe(section);
    });
}

// --- 9. INITIALIZATION ---

// FIX: Wrap initialization in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners
    searchWikiBtn.addEventListener('click', handleWikiSearch);
    searchAiBtn.addEventListener('click', handleAiSearch);
    newsFilterMenu.addEventListener('click', handleNewsFilterClick);
    aiQueryForm.addEventListener('submit', handleAiSubmit); // NEW listener for the live chat

    // Modal Listeners
    closeSearchModalBtn.addEventListener('click', () => toggleSearchModal(false));
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) toggleSearchModal(false);
    });

    closeArticleModalBtn.addEventListener('click', () => toggleArticleModal(false));
    articleModal.addEventListener('click', (e) => {
        if (e.target === articleModal) toggleArticleModal(false);
    });
    backToSearchBtn.addEventListener('click', () => {
        toggleArticleModal(false);
        toggleSearchModal(true);
    });
    articleBackBtn.addEventListener('click', handleArticleBack); // NEW listener for back button

    closeAiHelperBtn.addEventListener('click', () => toggleAiHelperModal(false));
    aiHelperModal.addEventListener('click', (e) => {
        if (e.target === aiHelperModal) toggleAiHelperModal(false);
    });

    // Close modals on 'Escape' key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleArticleModal(false);
            toggleSearchModal(false);
            toggleAiHelperModal(false);
        }
    });
    
    // Initial load
    loadNewsFeed();
    init3DBackground();
    initScrollAnimations();
});
