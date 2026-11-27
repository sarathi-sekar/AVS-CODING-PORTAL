try { if (localStorage.getItem('avs-theme') === 'dark') document.documentElement.classList.add('dark'); } catch (e) { /* storage blocked */ }
