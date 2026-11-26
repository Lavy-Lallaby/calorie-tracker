let pendingGeminiChatImageBase64 = null;

async function handleGeminiChatImageSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (typeof resizeImageToBase64 === 'function') {
        pendingGeminiChatImageBase64 = await resizeImageToBase64(file, 800);
    } else {
        const reader = new FileReader();
        pendingGeminiChatImageBase64 = await new Promise((resolve) => {
            reader.onload = () => resolve(String(reader.result).split(',')[1] || null);
            reader.readAsDataURL(file);
        });
    }
    const preview = document.getElementById('gemini-chat-img-preview');
    const wrap = document.getElementById('gemini-chat-img-preview-wrap');
    if (preview && pendingGeminiChatImageBase64) {
        preview.src = `data:image/jpeg;base64,${pendingGeminiChatImageBase64}`;
    }
    if (wrap) wrap.classList.remove('hidden');
    event.target.value = '';
}

function clearGeminiChatPendingImage() {
    pendingGeminiChatImageBase64 = null;
    const input = document.getElementById('gemini-chat-image-input');
    const wrap = document.getElementById('gemini-chat-img-preview-wrap');
    if (input) input.value = '';
    if (wrap) wrap.classList.add('hidden');
}
