var server = { urls: "stun:stun.l.google.com:19302" };

var dc, pc = new RTCPeerConnection({ iceServers: [server] });
pc.onaddstream = e => {
    v2.srcObject = e.stream;
};
pc.ondatachannel = e => dcInit(dc = e.channel);
pc.oniceconnectionstatechange = e => log(pc.iceConnectionState);

var haveGum = navigator.mediaDevices.getUserMedia({video:true, audio:true})
    .then(stream => pc.addStream(v1.srcObject = stream)).catch(log);

function dcInit() {
    dc.onopen = () => log("Chat!");
    dc.onmessage = e => log(e.data);
}

function createOffer() {
    button.disabled = true;
    offer_url.placeholder = 'Generating URL...';
    offer_url.disabled = true;
    dcInit(dc = pc.createDataChannel("chat"));
    haveGum.then(() => pc.createOffer()).then(d => pc.setLocalDescription(d))
        .catch(log);
    pc.onicecandidate = e => {
        if (e.candidate) return;
        offer_url.disabled = false;
        var compressed_offer = LZUTF8.compress(pc.localDescription.sdp, {"outputEncoding": "Base64"});

        offer_url.value = location.protocol + '//' + location.host + location.pathname + '#offer_base64=' + compressed_offer;
        offer_url.select();
        answer_base64.placeholder = "Paste answer here";
    };
};

function generateAnswer(offer_base64) {
    if (pc.signalingState != "stable"){
        console.log(pc.signalingState);
        setTimeout(function() {
            generateAnswer();
        }, 100);
        return;
    }
    button.disabled = true;
    var plain_offer = LZUTF8.decompress(offer_base64, {"inputEncoding": "Base64"});
    var desc = new RTCSessionDescription({ type:"offer", sdp: plain_offer });
pc.setRemoteDescription(desc)
        .then(() => pc.createAnswer()).then(d => pc.setLocalDescription(d))
        .catch(log);
    pc.onicecandidate = e => {
        if (e.candidate) return;
        answer_base64.value = btoa(pc.localDescription.sdp);
        answer_base64.select();
    };
}

answer_base64.onkeypress = e => {
    if (!enterPressed(e) || pc.signalingState != "have-local-offer") return;
    answer_base64.disabled = true;
    var desc = new RTCSessionDescription({ type:"answer", sdp: atob(answer_base64.value) });
    pc.setRemoteDescription(desc).catch(log);
};

chat.onkeypress = e => {
    if (!enterPressed(e)) return;
    dc.send(chat.value);
    log(chat.value);
    chat.value = "";
};

var enterPressed = e => e.keyCode == 13;
var log = msg => div.innerHTML += "<p>" + msg + "</p>";

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
            button.disabled = offer_url.disabled = true;
            generateAnswer(params.offer_base64);
        }
    } else {
        createOffer();
    }
}

setTimeout(function() {
    onPageLoadCheck();
}, 500);