// ./JS /style.js

document.addEventListener('DOMContentLoaded', () => {
  // --- Element Selections ---
  const logo = document.getElementById('logo');
  const themeToggle = document.getElementById('theme-toggle');
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  const connectionStatus = document.querySelector('.connection-status');
  const header = document.querySelector('.header');
  const aboutToggleBtn = document.querySelector('.collapse-toggle');
  const aboutContent = document.getElementById('aboutContent');

  // --- Initial Theme Setup ---
  const initializeTheme = () => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) {
      document.body.classList.add('dark-mode');
    }
    // Set initial state for the theme toggle button if it exists
    if (themeToggle) {
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-sun', isDark); // Show sun if dark
        icon.classList.toggle('fa-moon', !isDark); // Show moon if light
      }
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  };
  initializeTheme(); // Run theme setup immediately

  // --- Logo Sparkle Effect ---
  if (logo) {
    logo.addEventListener('click', (e) => {
      // Ensure click is on the <a> or its children, get bounds of <a>
      const logoLink = logo.querySelector('a') || logo; 
      const rect = logoLink.getBoundingClientRect();
      // Calculate click position relative to the logo link element
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      for (let i = 0; i < 12; i++) {
        const spark = document.createElement('div');
        spark.className = 'logo-spark'; // Add a class for styling sparks via CSS
        spark.style.left = `${clickX}px`;
        spark.style.top = `${clickY}px`;

        // Randomize trajectory and scale
        const angle = Math.random() * Math.PI * 2; // Random angle
        const distance = Math.random() * 30 + 20;  // Random distance
        const translateX = Math.cos(angle) * distance;
        const translateY = Math.sin(angle) * distance;
        const scale = Math.random() * 0.5 + 0.5; // Random scale factor

        // Apply initial position and animate out
        requestAnimationFrame(() => {
            spark.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            spark.style.opacity = '0';
        });
        
        logoLink.appendChild(spark); // Append to the link element
        
        // Remove spark after animation
        setTimeout(() => spark.remove(), 800); // Match animation duration
      }
    });
  }

  // --- Theme Toggle Functionality ---
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      
      // Update button aria attributes and icon
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-moon', !isDark);
        icon.classList.toggle('fa-sun', isDark);
      }
    });
  }

  // --- Header Scroll Effect ---
  if (header) {
    window.addEventListener('scroll', () => {
      // Add 'scrolled' class if user scrolls down more than 10px
      header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true }); // Use passive listener for better scroll performance
  }

  // --- Mobile Navigation Toggle ---
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!isExpanded));
      navLinks.classList.toggle('show'); // Toggle visibility class for nav links
      // Optional: Toggle body class to prevent scrolling when menu is open
      // document.body.classList.toggle('no-scroll', !isExpanded); 
    });
  }

  // --- Delayed Connection Status Indicator ---
  if (connectionStatus) {
    // Add 'show' class after 20 seconds to reveal the indicator
    setTimeout(() => {
      connectionStatus.classList.add('show');
    }, 20000); // 20 seconds delay
  }

  // --- About Section Toggle ---
  if (aboutToggleBtn && aboutContent) {
    // Set initial ARIA state based on CSS/default visibility on mobile
    const isInitiallyCollapsed = window.innerWidth <= 600 && !aboutContent.classList.contains('force-open');
    aboutToggleBtn.setAttribute('aria-expanded', String(!isInitiallyCollapsed));
    aboutToggleBtn.setAttribute('aria-controls', 'aboutContent');

    // Ensure CSS class matches initial state
    if (isInitiallyCollapsed) {
         aboutContent.classList.add('collapsed');
    }

    // Add click listener to toggle the section
    aboutToggleBtn.addEventListener('click', () => {
      const isCollapsed = aboutContent.classList.toggle('collapsed'); // Toggle content visibility
      aboutToggleBtn.classList.toggle('active'); // Toggle button active style (e.g., icon rotation)
      aboutToggleBtn.setAttribute('aria-expanded', String(!isCollapsed)); // Update ARIA state
    });
  }

}); // --- End of DOMContentLoaded ---


// --- Initialize Animate On Scroll (AOS) ---
// Can stay outside DOMContentLoaded as it often initializes itself correctly
AOS.init({
  once: true, // Only animate elements once
  duration: 1000, // Animation duration in milliseconds
  offset: 150, // Offset (in px) from the original trigger point
  easing: 'ease-out-cubic', // Default easing for AOS animations
  // disable: 'phone', // Optionally disable AOS on smaller devices
});

const faqItems = document.querySelectorAll('.faq-item');

if (faqItems.length > 0) {
    faqItems.forEach(item => {
        const questionButton = item.querySelector('.faq-question');
        const answerDiv = item.querySelector('.faq-answer');

        if (questionButton && answerDiv) {
            questionButton.addEventListener('click', () => {
                const isExpanded = questionButton.getAttribute('aria-expanded') === 'true';

                // Toggle ARIA attribute
                questionButton.setAttribute('aria-expanded', String(!isExpanded));
                // Toggle class for icon rotation
                questionButton.classList.toggle('active');
                // Toggle class for answer visibility (triggers CSS transition)
                answerDiv.classList.toggle('open');

                // Optional: Close other open FAQs when one is opened
                // faqItems.forEach(otherItem => {
                //     if (otherItem !== item) {
                //         otherItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                //         otherItem.querySelector('.faq-question').classList.remove('active');
                //         otherItem.querySelector('.faq-answer').classList.remove('open');
                //     }
                // });
            });
        }
    });
}