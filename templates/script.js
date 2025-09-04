// 店舗設定（GitHub Actionsで置換される）
const STORE_CONFIG = {
    storeId: '{{STORE_ID}}',
    liffId: '{{LIFF_ID}}',
    gasAvailabilityUrl: 'YOUR_GAS_AVAILABILITY_URL',
    gasReservationUrl: 'YOUR_GAS_RESERVATION_URL'
};

// 予約状態管理
let reservationState = {
    visitTime: 0,
    selectedMenu: null,
    selectedDate: null,
    selectedTime: null,
    customerInfo: {}
};

let calendar = {
    currentDate: new Date(),
    selectedDate: null
};

// LIFF初期化
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await liff.init({ liffId: STORE_CONFIG.liffId });
        console.log('LIFF initialized successfully');
        
        // プロファイル情報があれば自動入力
        if (liff.isLoggedIn()) {
            try {
                const profile = await liff.getProfile();
                if (profile.displayName) {
                    document.getElementById('customerName').value = profile.displayName;
                }
            } catch (error) {
                console.log('Profile not available:', error);
            }
        }
    } catch (error) {
        console.error('LIFF initialization failed:', error);
        // LIFF が利用できない場合でもフォームは動作する
    }
    
    initializeForm();
    initializeCalendar();
});

// フォーム初期化
function initializeForm() {
    // 来店回数選択
    document.querySelectorAll('.visit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.visit-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            reservationState.visitTime = parseInt(this.dataset.time);
            updateFormState();
        });
    });

    // メニュー選択
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            reservationState.selectedMenu = {
                id: this.dataset.id,
                time: parseInt(this.dataset.time),
                price: parseInt(this.dataset.price),
                name: this.querySelector('.menu-name').textContent
            };
            updateFormState();
        });
    });

    // 顧客情報入力監視
    ['customerName', 'customerPhone', 'customerMessage'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', function() {
                reservationState.customerInfo[id] = this.value;
                updateFormState();
            });
        }
    });

    // 送信ボタン
    document.getElementById('submitBtn').addEventListener('click', handleSubmit);
}

// カレンダー初期化
function initializeCalendar() {
    updateCalendarDisplay();
    
    document.getElementById('prevMonth').addEventListener('click', () => {
        calendar.currentDate.setMonth(calendar.currentDate.getMonth() - 1);
        updateCalendarDisplay();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        calendar.currentDate.setMonth(calendar.currentDate.getMonth() + 1);
        updateCalendarDisplay();
    });
}

// カレンダー表示更新
function updateCalendarDisplay() {
    const monthNames = [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月'
    ];
    
    const currentMonth = document.getElementById('currentMonth');
    currentMonth.textContent = `${calendar.currentDate.getFullYear()}年 ${monthNames[calendar.currentDate.getMonth()]}`;
    
    const calendarGrid = document.getElementById('calendar');
    calendarGrid.innerHTML = '';
    
    // 曜日ヘッダー
    const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.textContent = day;
        header.style.fontWeight = 'bold';
        header.style.textAlign = 'center';
        header.style.padding = '10px 0';
        header.style.backgroundColor = '#f8f9fa';
        calendarGrid.appendChild(header);
    });
    
    // 月の最初の日と最後の日
    const firstDay = new Date(calendar.currentDate.getFullYear(), calendar.currentDate.getMonth(), 1);
    const lastDay = new Date(calendar.currentDate.getFullYear(), calendar.currentDate.getMonth() + 1, 0);
    
    // 最初の週の空白日
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day disabled';
        calendarGrid.appendChild(emptyDay);
    }
    
    // 日付
    const today = new Date();
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const currentDate = new Date(calendar.currentDate.getFullYear(), calendar.currentDate.getMonth(), day);
        
        // 過去の日付は無効化
        if (currentDate < today.setHours(0, 0, 0, 0)) {
            dayElement.classList.add('disabled');
        } else {
            dayElement.addEventListener('click', () => selectDate(currentDate));
        }
        
        // 今日の日付をハイライト
        if (currentDate.toDateString() === new Date().toDateString()) {
            dayElement.classList.add('today');
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

// 日付選択
function selectDate(date) {
    // 既存の選択をクリア
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    // 新しい選択をマーク
    event.target.classList.add('selected');
    reservationState.selectedDate = date;
    
    // 時間選択を表示
    loadTimeSlots(date);
    updateFormState();
}

// 時間枠読み込み
async function loadTimeSlots(date) {
    const timePicker = document.getElementById('timePicker');
    const timeSlots = document.getElementById('timeSlots');
    
    timePicker.style.display = 'block';
    timeSlots.innerHTML = '<p>読み込み中...</p>';
    
    try {
        // GAS から空き時間を取得
        const response = await fetch(`${STORE_CONFIG.gasAvailabilityUrl}?store=${STORE_CONFIG.storeId}&date=${date.toISOString().split('T')[0]}`);
        const availableSlots = await response.json();
        
        timeSlots.innerHTML = '';
        
        if (availableSlots.length === 0) {
            timeSlots.innerHTML = '<p>申し訳ございません。この日は予約がいっぱいです。</p>';
            return;
        }
        
        availableSlots.forEach(slot => {
            const timeElement = document.createElement('div');
            timeElement.className = 'time-slot';
            timeElement.textContent = slot.time;
            timeElement.addEventListener('click', () => selectTime(slot));
            timeSlots.appendChild(timeElement);
        });
        
    } catch (error) {
        console.error('時間枠の読み込みに失敗:', error);
        timeSlots.innerHTML = '<p>時間枠の読み込みに失敗しました。</p>';
    }
}

// 時間選択
function selectTime(timeSlot) {
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    event.target.classList.add('selected');
    reservationState.selectedTime = timeSlot;
    updateFormState();
}

// フォーム状態更新
function updateFormState() {
    updateSummary();
    updateSubmitButton();
}

// 予約内容サマリー更新
function updateSummary() {
    const summarySection = document.getElementById('summarySection');
    
    // 必要な情報が揃ったらサマリーを表示
    const hasRequiredInfo = reservationState.visitTime > 0 && 
                          reservationState.selectedMenu && 
                          reservationState.selectedDate && 
                          reservationState.selectedTime;
    
    if (hasRequiredInfo) {
        summarySection.style.display = 'block';
        
        document.getElementById('summaryVisit').textContent = 
            reservationState.visitTime === 30 ? '初めて（+30分）' : '2回目以降（+15分）';
        
        document.getElementById('summaryMenu').textContent = 
            `${reservationState.selectedMenu.name} (${reservationState.selectedMenu.time}分・¥${reservationState.selectedMenu.price})`;
        
        const dateStr = reservationState.selectedDate.toLocaleDateString('ja-JP', {
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
        document.getElementById('summaryDateTime').textContent = 
            `${dateStr} ${reservationState.selectedTime.time}`;
        
        document.getElementById('summaryName').textContent = 
            reservationState.customerInfo.customerName || '未入力';
        
        document.getElementById('summaryPhone').textContent = 
            reservationState.customerInfo.customerPhone || '未入力';
    } else {
        summarySection.style.display = 'none';
    }
}

// 送信ボタン状態更新
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    
    const isValid = reservationState.visitTime > 0 && 
                   reservationState.selectedMenu && 
                   reservationState.selectedDate && 
                   reservationState.selectedTime && 
                   name && 
                   phone;
    
    submitBtn.disabled = !isValid;
}

// 予約送信処理
async function handleSubmit() {
    const submitBtn = document.getElementById('submitBtn');
    
    if (submitBtn.disabled) return;
    
    // ローディング状態
    submitBtn.classList.add('loading');
    submitBtn.textContent = '送信中...';
    submitBtn.disabled = true;
    
    try {
        // 予約データ作成
        const reservationData = {
            storeId: STORE_CONFIG.storeId,
            customerName: document.getElementById('customerName').value.trim(),
            customerPhone: document.getElementById('customerPhone').value.trim(),
            customerMessage: document.getElementById('customerMessage').value.trim(),
            visitTime: reservationState.visitTime,
            menu: reservationState.selectedMenu,
            date: reservationState.selectedDate.toISOString().split('T')[0],
            time: reservationState.selectedTime.time,
            totalTime: reservationState.selectedMenu.time + reservationState.visitTime
        };
        
        // GAS経由で予約処理
        const response = await fetch(STORE_CONFIG.gasReservationUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reservationData)
        });
        
        if (!response.ok) {
            throw new Error('予約処理に失敗しました');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || '予約処理に失敗しました');
        }
        
        // LINE トークに送信
        if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
            const message = createReservationMessage(reservationData);
            await liff.sendMessages([{
                type: 'text',
                text: message
            }]);
        }
        
        // 成功メッセージ表示
        showSuccessMessage();
        
        // LIFFウィンドウを閉じる
        setTimeout(() => {
            if (typeof liff !== 'undefined') {
                liff.closeWindow();
            }
        }, 2000);
        
    } catch (error) {
        console.error('予約送信エラー:', error);
        showErrorMessage(error.message || '予約送信に失敗しました。もう一度お試しください。');
    } finally {
        // ローディング状態解除
        submitBtn.classList.remove('loading');
        submitBtn.textContent = '予約を行う';
        submitBtn.disabled = false;
    }
}

// 予約メッセージ作成
function createReservationMessage(data) {
    const dateStr = reservationState.selectedDate.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    });
    
    return `【予約完了】
店舗: ${document.querySelector('header h1').textContent.replace('\n予約フォーム', '')}
お名前: ${data.customerName}
電話番号: ${data.customerPhone}
来店: ${data.visitTime === 30 ? '初めて' : '2回目以降'}
メニュー: ${data.menu.name} (${data.menu.time}分・¥${data.menu.price})
日時: ${dateStr} ${data.time}
${data.customerMessage ? `ご要望: ${data.customerMessage}` : ''}

※当日キャンセルは無いようにお願いします`;
}

// 成功メッセージ表示
function showSuccessMessage() {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = '予約が完了しました！ありがとうございます。';
    
    const container = document.querySelector('.container');
    container.insertBefore(successDiv, container.firstChild);
    
    // ページトップにスクロール
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// エラーメッセージ表示
function showErrorMessage(message) {
    // 既存のエラーメッセージを削除
    const existingError = document.querySelector('.error-message');
    if (existingError && existingError.parentNode === document.querySelector('.container')) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(errorDiv, container.firstChild);
    
    // ページトップにスクロール
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
