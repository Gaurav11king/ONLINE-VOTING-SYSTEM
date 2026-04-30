console.log('Live script loaded');

const socket = io();

socket.on('connect', () => {
    console.log('✅ Socket connected');
});

socket.on('connect_error', (err) => {
    console.error('❌ Socket connection error:', err);
});

socket.on('voteUpdate', (data) => {
    console.log('📊 Vote update received:', data);
    updateDashboard(data.parties);
});

// Initial load
fetch('/api/results')
    .then(r => {
        if (!r.ok) throw new Error('API response not OK: ' + r.status);
        return r.json();
    })
    .then(parties => {
        console.log('Initial results loaded:', parties);
        updateDashboard(parties);
    })
    .catch(err => {
        console.error('❌ Error loading results:', err);
        document.querySelector('#resultsTable tbody').innerHTML = 
            `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${err.message}</td></tr>`;
    });

function updateDashboard(parties) {
    console.log('Updating dashboard with:', parties);
    
    if (!parties || !Array.isArray(parties)) {
        console.error('Invalid parties data:', parties);
        return;
    }
    
    const totalVotes = parties.reduce((sum, p) => sum + p.votes, 0);
    document.getElementById('totalVotes').textContent = `Total Votes: ${totalVotes}`;
    
    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = '';
    
    if (parties.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No votes yet</td></tr>';
        return;
    }
    
    parties.forEach((party, index) => {
        const percent = totalVotes > 0 ? ((party.votes / totalVotes) * 100).toFixed(1) : 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${party.name}</strong></td>
            <td style="font-size:24px;">${party.symbol}</td>
            <td style="font-size:28px; font-weight:bold; color:#4CAF50;">${party.votes}</td>
            <td style="font-weight:bold;">${percent}%</td>
        `;
        tbody.appendChild(row);
    });
}

// Fallback refresh
setInterval(() => {
    fetch('/api/results')
        .then(r => r.json())
        .then(updateDashboard)
        .catch(err => console.error('Refresh error:', err));
}, 3000);
