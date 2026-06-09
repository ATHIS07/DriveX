// script.js - DriveX Complete Frontend Logic

// ==================== APP STATE ====================
let files = [];          // Array of file objects
let currentRenameFileId = null;
let currentDeleteFileId = null;
let currentFilter = "all";
let currentSort = "name";

// Helper: Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper: Get file type category
function getFileCategory(fileName, mimeType = '') {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
    if (['mp4','mov','avi','mkv'].includes(ext)) return 'video';
    if (['pdf','doc','docx','txt','md','xlsx','pptx'].includes(ext)) return 'document';
    if (['zip','rar','7z','tar','gz'].includes(ext)) return 'archive';
    return 'other';
}

// Get icon class based on type
function getFileIcon(fileType) {
    const icons = {
        image: 'fas fa-image',
        video: 'fas fa-video',
        document: 'fas fa-file-alt',
        archive: 'fas fa-archive',
        other: 'fas fa-file'
    };
    return icons[fileType] || icons.other;
}

// Update dashboard stats & storage
function updateStats() {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const sharedCount = files.filter(f => f.shared === true).length;
    const maxStorage = 20 * 1024 * 1024 * 1024; // 20GB mock
    const usedPercent = (totalSize / maxStorage) * 100;
    const available = maxStorage - totalSize;

    document.getElementById('totalFilesCount').innerText = totalFiles;
    document.getElementById('storageUsed').innerText = formatBytes(totalSize);
    document.getElementById('sharedFilesCount').innerText = sharedCount;
    document.getElementById('availableStorage').innerText = formatBytes(available);
    document.getElementById('usedStorageDetail').innerText = formatBytes(totalSize);
    document.getElementById('availableStorageDetail').innerText = formatBytes(available);
    const percentVal = Math.min(100, Math.floor(usedPercent));
    document.getElementById('storagePercentage').innerText = `${percentVal}%`;
    document.getElementById('storageProgressFill').style.width = `${percentVal}%`;

    // Animate counters (simple numbers)
    animateNumber('totalFilesCount', 0, totalFiles);
}

function animateNumber(elementId, start, end) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let current = start;
    const step = Math.ceil((end - start) / 30);
    const interval = setInterval(() => {
        current += step;
        if (current >= end) {
            el.innerText = end;
            clearInterval(interval);
        } else {
            if (elementId === 'storageUsed') return; // skip complex for bytes
            el.innerText = current;
        }
    }, 15);
}

// Render files grid with filter & sort
function renderFiles() {
    let filtered = [...files];
    if (currentFilter !== 'all') {
        filtered = filtered.filter(f => f.category === currentFilter);
    }

    // Sorting
    if (currentSort === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name));
    if (currentSort === 'date') filtered.sort((a,b) => b.uploadDate - a.uploadDate);
    if (currentSort === 'size') filtered.sort((a,b) => b.size - a.size);
    if (currentSort === 'type') filtered.sort((a,b) => a.category.localeCompare(b.category));

    const grid = document.getElementById('filesGrid');
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state glass-card">
            <i class="fas fa-cloud-upload-alt"></i>
            <h3>No files yet</h3>
            <p>Upload your first file via drag & drop or the upload button.</p>
            <button class="btn-primary" id="emptyUploadBtn" style="margin-top:1rem;"><i class="fas fa-upload"></i> Upload File</button>
        </div>`;
        const emptyBtn = document.getElementById('emptyUploadBtn');
        if (emptyBtn) emptyBtn.addEventListener('click', () => document.getElementById('fileInput').click());
        return;
    }

    grid.innerHTML = filtered.map(file => `
        <div class="file-card" data-id="${file.id}">
            <div class="file-icon"><i class="${getFileIcon(file.category)}"></i></div>
            <div class="file-name">${escapeHtml(file.name)}</div>
            <div class="file-meta">
                <span>${formatBytes(file.size)}</span>
                <span>${new Date(file.uploadDate).toLocaleDateString()}</span>
            </div>
            <div class="file-actions">
                <button class="action-btn download-btn" data-id="${file.id}"><i class="fas fa-download"></i> Download</button>
                <button class="action-btn share-btn" data-id="${file.id}"><i class="fas fa-share-alt"></i> Share</button>
                <button class="action-btn rename-btn" data-id="${file.id}"><i class="fas fa-pen"></i> Rename</button>
                <button class="action-btn delete-btn" data-id="${file.id}"><i class="fas fa-trash"></i> Del</button>
                <button class="action-btn details-btn" data-id="${file.id}"><i class="fas fa-info-circle"></i> Details</button>
            </div>
        </div>
    `).join('');

    // attach dynamic actions
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); downloadFileById(btn.dataset.id); });
    });
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openShareModal(btn.dataset.id); });
    });
    document.querySelectorAll('.rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openRenameModal(btn.dataset.id); });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteFile(btn.dataset.id); });
    });
    document.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); showFileDetails(btn.dataset.id); });
    });
}

function escapeHtml(str) { return str.replace(/[&<>]/g, function(m){ if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

// Add new file(s)
function addFiles(fileList) {
    const newFiles = [];
    for (let i = 0; i < fileList.length; i++) {
        const rawFile = fileList[i];
        const category = getFileCategory(rawFile.name, rawFile.type);
        const fileObj = {
            id: Date.now() + i + Math.random(),
            name: rawFile.name,
            size: rawFile.size,
            type: rawFile.type,
            category: category,
            uploadDate: Date.now(),
            lastModified: rawFile.lastModified,
            shared: false,
            blob: rawFile,   // store actual File object for download
        };
        newFiles.push(fileObj);
    }
    files.push(...newFiles);
    updateStats();
    renderFiles();
    showToast(`✅ ${newFiles.length} file(s) uploaded successfully!`, 'success');
}

// Download
function downloadFileById(id) {

    window.open(
        `http://13.207.200.134:5000/download/${id}`,
        "_blank"
    );

}

// Share modal
let currentShareFileId = null;
function openShareModal(fileId) {
    const file = files.find(f => f.id == fileId);
    if (!file) return;
    currentShareFileId = fileId;
    const shareLink =
`http://13.207.200.134:5000/share/${file.id}`;
    document.getElementById('shareLinkInput').value = shareLink;
    document.getElementById('shareModal').classList.add('show');
}

document.getElementById('copyLinkBtn').addEventListener('click', () => {
    const linkInput = document.getElementById('shareLinkInput');
    linkInput.select();
    document.execCommand('copy');
    showToast('🔗 Share link copied to clipboard!', 'success');
    if (currentShareFileId) {
        const f = files.find(f => f.id == currentShareFileId);
        if (f) { f.shared = true; updateStats(); renderFiles(); }
    }
    document.getElementById('shareModal').classList.remove('show');
});

// Rename Logic
function openRenameModal(fileId) {
    const file = files.find(f => f.id == fileId);
    if (!file) return;
    currentRenameFileId = fileId;
    document.getElementById('renameInput').value = file.name;
    document.getElementById('renameModal').classList.add('show');
}

document.getElementById('confirmRenameBtn').addEventListener('click', async () => {

    const newName = document.getElementById('renameInput').value.trim();

    if (!newName || !currentRenameFileId) return;

    try {

        await fetch(
            `http://13.207.200.134:5000/files/${currentRenameFileId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    newName
                })
            }
        );

        await loadFiles();

        showToast(
            `✏️ File renamed to "${newName}"`,
            "success"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Rename failed",
            "error"
        );

    }

    document.getElementById('renameModal').classList.remove('show');

    currentRenameFileId = null;

});

// Delete confirmation
function confirmDeleteFile(fileId) {
    currentDeleteFileId = fileId;
    document.getElementById('confirmModal').classList.add('show');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {

    if (!currentDeleteFileId) return;

    try {

        await fetch(
            `http://13.207.200.134:5000/files/${currentDeleteFileId}`,
            {
                method: "DELETE"
            }
        );

        await loadFiles();

        showToast(
            '🗑️ File deleted permanently',
            'success'
        );

    } catch (error) {

        console.error(error);

        showToast(
            'Delete failed',
            'error'
        );

    }

    document.getElementById('confirmModal').classList.remove('show');

    currentDeleteFileId = null;

});

// File Details Modal
function showFileDetails(fileId) {
    const file = files.find(f => f.id == fileId);
    if (file) {
        document.getElementById('detailName').innerText = file.name;
        document.getElementById('detailType').innerText = file.type || file.category;
        document.getElementById('detailSize').innerText = formatBytes(file.size);
        document.getElementById('detailUploadDate').innerText = new Date(file.uploadDate).toLocaleString();
        document.getElementById('detailModified').innerText = new Date(file.lastModified).toLocaleString();
        document.getElementById('detailShareStatus').innerText = file.shared ? 'Shared via link' : 'Not shared';
        document.getElementById('detailsModal').classList.add('show');
    }
}

// Search live
document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (term === "") {
        renderFiles();
    } else {
        const filteredByName = files.filter(f => f.name.toLowerCase().includes(term));
        const originalFilter = currentFilter;
        const originalSort = currentSort;
        let tempFiles = [...filteredByName];
        if (currentSort === 'name') tempFiles.sort((a,b) => a.name.localeCompare(b.name));
        if (currentSort === 'date') tempFiles.sort((a,b) => b.uploadDate - a.uploadDate);
        if (currentSort === 'size') tempFiles.sort((a,b) => b.size - a.size);
        const grid = document.getElementById('filesGrid');
        if (tempFiles.length === 0) {
            grid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>No matching files</p></div>`;
        } else {
            renderFilteredCustom(tempFiles);
        }
    }
});

function renderFilteredCustom(fileArray) {
    const grid = document.getElementById('filesGrid');
    if (fileArray.length === 0) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No results</p></div>`;
        return;
    }
    grid.innerHTML = fileArray.map(file => `
        <div class="file-card" data-id="${file.id}">
            <div class="file-icon"><i class="${getFileIcon(file.category)}"></i></div>
            <div class="file-name">${escapeHtml(file.name)}</div>
            <div class="file-meta"><span>${formatBytes(file.size)}</span><span>${new Date(file.uploadDate).toLocaleDateString()}</span></div>
            <div class="file-actions">
                <button class="action-btn download-btn" data-id="${file.id}"><i class="fas fa-download"></i> Download</button>
                <button class="action-btn share-btn" data-id="${file.id}"><i class="fas fa-share-alt"></i> Share</button>
                <button class="action-btn rename-btn" data-id="${file.id}"><i class="fas fa-pen"></i> Rename</button>
                <button class="action-btn delete-btn" data-id="${file.id}"><i class="fas fa-trash"></i> Del</button>
                <button class="action-btn details-btn" data-id="${file.id}"><i class="fas fa-info-circle"></i> Details</button>
            </div>
        </div>
    `).join('');
    reattachActionsToDynamic();
}

function reattachActionsToDynamic() {
    document.querySelectorAll('.download-btn').forEach(btn => btn.addEventListener('click',(e)=>{e.stopPropagation(); downloadFileById(btn.dataset.id);}));
    document.querySelectorAll('.share-btn').forEach(btn => btn.addEventListener('click',(e)=>{e.stopPropagation(); openShareModal(btn.dataset.id);}));
    document.querySelectorAll('.rename-btn').forEach(btn => btn.addEventListener('click',(e)=>{e.stopPropagation(); openRenameModal(btn.dataset.id);}));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click',(e)=>{e.stopPropagation(); confirmDeleteFile(btn.dataset.id);}));
    document.querySelectorAll('.details-btn').forEach(btn => btn.addEventListener('click',(e)=>{e.stopPropagation(); showFileDetails(btn.dataset.id);}));
}

// Sorting & Filtering listeners
document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderFiles();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderFiles();
    });
});

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':type==='error'?'fa-exclamation-triangle':'fa-info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// Upload Logic (Buttons & Drag drop)
function triggerFileUpload() {
    document.getElementById('fileInput').click();
}

document.getElementById('uploadBtnHeader').addEventListener('click', triggerFileUpload);
document.getElementById('uploadBtnDrop').addEventListener('click', triggerFileUpload);
document.getElementById('fileInput').addEventListener('change', async (e) => {

    const selectedFiles = e.target.files;

    if (!selectedFiles.length) return;

    for (const file of selectedFiles) {

        const formData = new FormData();

        formData.append("file", file);

        try {

            const response = await fetch(
                "http://13.207.200.134:5000/upload",
                {
                    method: "POST",
                    body: formData
                }
            );

            const data = await response.json();

console.log(data);

await loadFiles();

showToast(
    `${file.name} uploaded successfully`,
    "success"
);

        } catch (error) {

            console.error(error);

            showToast(
                "Upload failed",
                "error"
            );
        }
    }

    e.target.value = '';
});

// Drag & Drop
const dropZone = document.getElementById('dragDropZone');
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// Close modals
document.querySelectorAll('.close-modal, .close-confirm').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
    });
});
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) e.target.classList.remove('show');
});

// Initialize demo sample files
async function loadFiles() {

    try {

        const response = await fetch(
            "http://13.207.200.134:5000/files"
        );

        const data = await response.json();

        files = data.map(file => ({
            id: file.id,
            name: file.originalName,
            size: file.size,
            type: "",
            category: getFileCategory(file.originalName),
            uploadDate: new Date(file.uploadDate).getTime(),
            lastModified: new Date(file.uploadDate).getTime(),
            shared: false
        }));

        updateStats();
        renderFiles();

    } catch (error) {

        console.error(error);

    }

}
// Additional live search integration override: call renderFiles after filtering if search empty else search handling
const searchBox = document.getElementById('searchInput');
const originalRender = renderFiles;
window.renderFiles = renderFiles;
searchBox.addEventListener('input', () => {
    const term = searchBox.value.toLowerCase();
    if(term === "") renderFiles();
    else {
        const filteredByName = files.filter(f => f.name.toLowerCase().includes(term));
        renderFilteredCustom(filteredByName);
    }
});
loadFiles();