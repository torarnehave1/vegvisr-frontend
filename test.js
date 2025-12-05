// Create a comprehensive guide node
const createGuideNode = (id, title, content) => {
  cy.add({
    data: {
      id,
      label: title,
      type: 'guide',
      fullText: content,
      created: new Date().toISOString()
    }
  });

  cy.layout({ name: 'cose' }).run();
};

// Display full text in side panel on click
cy.on('tap', 'node[type="guide"]', (evt) => {
  const node = evt.target;
  const panel = document.getElementById('text-panel');

  panel.innerHTML = `
    <h2>${node.data('label')}</h2>
    <div>${node.data('fullText')}</div>
  `;

  panel.style.display = 'block';
});

