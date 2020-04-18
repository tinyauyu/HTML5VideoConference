var server = { urls: "stun:stun.l.google.com:19302" };

var log = msg => div.innerHTML += "<p>" + msg + "</p>";

var dc, pc = new RTCPeerConnection({ iceServers: [server] });
pc.ontrack = e => {
    // alert('onaddstream!');
    log('onaddstream!');
    // v2.srcObject = e.stream;
    v2.srcObject = e.streams[0];
};
pc.ondatachannel = e => dcInit(dc = e.channel);
pc.oniceconnectionstatechange = e => log(pc.iceConnectionState);

var haveGum = navigator.mediaDevices.getUserMedia({video:true, audio:true})
    .then(stream => {
        for (const track of stream.getTracks()) {
            pc.addTrack(track, stream);
            v1.srcObject = stream;
        }
        // pc.addStream(v1.srcObject = stream);
        // alert('addStream');
        log('addStream');
    }).catch(log);

function dcInit() {
    dc.onopen = () => {
        log("Chat!");
        $('#overlay').remove();
        $('#main').removeClass("d-none");
    };
    dc.onmessage = e => log(e.data);
}

function createOffer() {
    console.log("create offer");
    offer_url.placeholder = 'Generating URL...';
    offer_url.disabled = true;
    dcInit(dc = pc.createDataChannel("chat"));
    haveGum.then(() => pc.createOffer()).then(d => pc.setLocalDescription(d))
        .catch(log);
    pc.onicecandidate = e => {
        if (e.candidate) return;
        console.log("offer ready");
        $('#loading_div').addClass('d-none');
        $('#offer_div').removeClass('d-none');
        $('#answer_div').removeClass('d-none');
        $('#answer_div_copy').remove();
        offer_url.disabled = false;
        var compressed_offer = LZUTF8.compress(pc.localDescription.sdp, {"outputEncoding": "Base64"});

        offer_url.value = location.protocol + '//' + location.host + location.pathname + '#offer_base64=' + compressed_offer;
        offer_url.select();
        answer_base64.placeholder = "Paste answer here";

        add_answer_listener();
    };
}

function copyOffer() {
    /* Get the text field */
    var copyText = document.getElementById("offer_url");

    /* Select the text field */
    copyText.select();
    copyText.setSelectionRange(0, 99999); /*For mobile devices*/

    /* Copy the text inside the text field */
    document.execCommand("copy");

    console.log('copy Offer')
}

function generateAnswer(offer_base64) {
    if (pc.signalingState != "stable"){
        console.log(pc.signalingState);
        setTimeout(function() {
            generateAnswer();
        }, 100);
        return;
    }
    var plain_offer = LZUTF8.decompress(offer_base64, {"inputEncoding": "Base64"});
    var desc = new RTCSessionDescription({ type:"offer", sdp: plain_offer });
    pc.setRemoteDescription(desc)
        .then(() => pc.createAnswer()).then(d => pc.setLocalDescription(d))
        .catch(log);
    pc.onicecandidate = e => {
        if (e.candidate) return;
        $('#loading_div').addClass('d-none');
        $('#answer_div').removeClass('d-none');
        $('#answer_div_enter').remove();
        answer_base64.value = location.protocol + '//' + location.host + location.pathname + '#answer_base64=' + btoa(pc.localDescription.sdp);
        answer_base64.select();
    };
}

function copyAnswer() {
    /* Get the text field */
    var copyText = document.getElementById("answer_base64");

    /* Select the text field */
    copyText.select();
    copyText.setSelectionRange(0, 99999); /*For mobile devices*/

    /* Copy the text inside the text field */
    document.execCommand("copy");

    console.log('copy Answer')
}

function submitAnswer(answer_base64){
    if (pc.signalingState != "have-local-offer") return;
    answer_base64.disabled = true;
    var desc = new RTCSessionDescription({ type:"answer", sdp: atob(answer_base64) });
    pc.setRemoteDescription(desc).catch(log);
    $('#overlay').remove();
    $('#main').removeClass("d-none");
}

function add_answer_listener() {
    window.addEventListener('storage', function(e){
        if (e.key == "answer_base64") {
            submitAnswer(localStorage.getItem('answer_base64'));
        }
    })
}

answer_base64.onkeypress = e => {
    if (!enterPressed(e) || pc.signalingState != "have-local-offer") return;
    answer_base64.disabled = true;
    var desc = new RTCSessionDescription({ type:"answer", sdp: atob(answer_base64.value) });
    pc.setRemoteDescription(desc).catch(log);
    $('#overlay').remove();
    $('#main').removeClass("d-none");
};

chat.onkeypress = e => {
    if (!enterPressed(e)) return;
    dc.send(chat.value);
    log(chat.value);
    chat.value = "";
};

var enterPressed = e => e.keyCode == 13;

function parse_query_string(query) {
    var vars = query.split("&");
    var query_string = {};
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        var key = decodeURIComponent(pair[0]);
        var value = decodeURIComponent(pair[1]);
        // If first entry with this name
        if (typeof query_string[key] === "undefined") {
            query_string[key] = decodeURIComponent(value);
            // If second entry with this name
        } else if (typeof query_string[key] === "string") {
            var arr = [query_string[key], decodeURIComponent(value)];
            query_string[key] = arr;
            // If third or later entry with this name
        } else {
            query_string[key].push(decodeURIComponent(value));
        }
    }
    return query_string;
}

function onPageLoadCheck(){
    var fragment = location.hash.substr(1);
    if (fragment) {
        var params = parse_query_string(fragment);
        if (params.offer_base64){
            generateAnswer(params.offer_base64);
        } else if (params.answer_base64) {
            localStorage.setItem('answer_base64', params.answer_base64);
            $('#loading_div').addClass('d-none');
            $('#close_div').removeClass('d-none');
            window.close();
        }
    } else {
        createOffer();
    }
}

setTimeout(function() {
    onPageLoadCheck();
}, 500);