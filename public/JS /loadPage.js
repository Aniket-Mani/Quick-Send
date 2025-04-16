document.addEventListener('DOMContentLoaded', () => {

  // Function to handle smooth scrolling
  const smoothScrollTo = (targetId) => {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      // Update the URL hash without causing a page jump
      history.pushState(null, '', `#${targetId}`);
      
      // Scroll smoothly to the element
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start' // Aligns the top of the element to the top of the viewport
      });
    } else {
      console.warn(`Element with ID "${targetId}" not found.`);
      // Fallback for 'home' or if element doesn't exist: scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
       // Optionally reset hash if target not found, or keep it
      history.pushState(null, '', window.location.pathname + window.location.search); // Reset hash if element not found
    }
  };

  // Handle nav link clicks
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default anchor jump

      // Get the target ID (e.g., 'about' from '#about')
      const href = e.target.getAttribute('href');
      const targetId = href ? href.substring(1) : null;

      if (targetId) {
          if (targetId === 'home') {
             // Scroll to the top (or to a specific element with id="home" if you have one)
             const homeElement = document.getElementById('home'); // Check if your main section has id="home"
             if (homeElement) {
                 smoothScrollTo('home');
             } else {
                 window.scrollTo({ top: 0, behavior: 'smooth' });
                 history.pushState(null, '', window.location.pathname + window.location.search); // Clear hash for top
             }
          } else {
            smoothScrollTo(targetId); // Scroll to the specific section
          }
      }
    });
  });

  // Handle logo click - scrolls to top smoothly
  const logo = document.querySelector('.logo a');
  logo?.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent default link navigation
     // Scroll to the top (or to a specific element with id="home" if you have one)
     const homeElement = document.getElementById('home'); // Check if your main section has id="home"
     if (homeElement) {
         smoothScrollTo('home');
     } else {
         window.scrollTo({ top: 0, behavior: 'smooth' });
         history.pushState(null, '', window.location.pathname + window.location.search); // Clear hash for top
     }
  });

  // Optional: Handle initial load scrolling if there's a hash in the URL
  const hash = window.location.hash.substring(1);
  if (hash) {
    // Use setTimeout to ensure the page layout is stable before scrolling
    setTimeout(() => {
        const targetElement = document.getElementById(hash);
        if (targetElement) {
             targetElement.scrollIntoView({ behavior: 'auto', block: 'start' }); // 'auto' for instant jump on load
        }
    }, 100); // Small delay might be needed
  }
});