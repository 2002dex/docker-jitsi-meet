(function () {
    'use strict';

    if (window.__jitsi_ipv6_check_initialized) return;
    window.__jitsi_ipv6_check_initialized = true;

    var ipv6Config = (window.config && window.config.ipv6Check) || {};
    if (ipv6Config.enabled === false) return;

    var CHECK_URL = ipv6Config.checkUrl || 'https://nodedata.io/my-ipv6';
    var TIMEOUT_MS = ipv6Config.timeout || 5000;

    var state = {
        status: 'checking', // 'checking', 'success', 'warning'
        ip: null,
        message: 'Checking IPv6 network support...'
    };

    function isIPv6(str) {
        if (!str || typeof str !== 'string') return false;
        var cleanStr = str.trim().replace(/^\[|\]$/g, '');
        var ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7}|:))$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,6}(:[0-9a-fA-F]{1,4})$/;
        return ipv6Regex.test(cleanStr);
    }

    function checkIPv6WebRTC() {
        return new Promise(function (resolve) {
            if (!window.RTCPeerConnection) {
                resolve(false);
                return;
            }
            var hasIPv6 = false;
            var pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.onicecandidate = function (e) {
                if (e.candidate && e.candidate.candidate) {
                    var parts = e.candidate.candidate.split(' ');
                    if (parts.length >= 5) {
                        var ip = parts[4];
                        if (isIPv6(ip)) {
                            hasIPv6 = true;
                            if (!state.ip) state.ip = ip;
                        }
                    }
                }
            };

            try {
                pc.createDataChannel('');
                pc.createOffer()
                    .then(function (offer) { return pc.setLocalDescription(offer); })
                    .catch(function () {});
            } catch (err) {}

            setTimeout(function () {
                try { pc.close(); } catch (err) {}
                resolve(hasIPv6);
            }, 2000);
        });
    }

    function performIPv6Check() {
        var controller = window.AbortController ? new AbortController() : null;
        var timeoutId = setTimeout(function () {
            if (controller) controller.abort();
        }, TIMEOUT_MS);

        fetch(CHECK_URL, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined
        })
            .then(function (res) {
                clearTimeout(timeoutId);
                if (res.ok) {
                    return res.text();
                }
                throw new Error('HTTP ' + res.status);
            })
            .then(function (text) {
                var detectedIp = null;
                try {
                    var data = JSON.parse(text);
                    detectedIp = data.ip || data.ipv6 || data.address || text;
                } catch (e) {
                    detectedIp = text.trim();
                }

                state.status = 'success';
                state.ip = isIPv6(detectedIp) ? detectedIp : (state.ip || 'Active');
                state.message = 'IPv6 Network Supported';
                updateUI();
            })
            .catch(function () {
                clearTimeout(timeoutId);
                // Fallback to WebRTC ICE candidate check if HTTP fetch fails or CORS restricts
                checkIPv6WebRTC().then(function (webrtcHasIPv6) {
                    if (webrtcHasIPv6) {
                        state.status = 'success';
                        state.message = 'IPv6 Supported (ICE Verified)';
                    } else {
                        state.status = 'warning';
                        state.message = 'IPv6 Not Detected (JVB Connection May Fail)';
                    }
                    updateUI();
                });
            });
    }

    function createOrGetBadgeElement() {
        var existing = document.getElementById('jitsi-ipv6-lobby-badge');
        if (existing) return existing;

        var badge = document.createElement('div');
        badge.id = 'jitsi-ipv6-lobby-badge';
        badge.style.cssText = [
            'display: flex',
            'align-items: center',
            'gap: 10px',
            'padding: 10px 14px',
            'margin: 12px 0',
            'border-radius: 8px',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            'font-size: 13px',
            'font-weight: 500',
            'line-height: 1.4',
            'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)',
            'transition: all 0.3s ease',
            'backdrop-filter: blur(8px)',
            '-webkit-backdrop-filter: blur(8px)',
            'z-index: 1000'
        ].join(';');

        return badge;
    }

    function updateUI() {
        var badge = createOrGetBadgeElement();
        var iconHtml = '';
        var bgStyle = '';
        var textStyle = '';
        var borderStyle = '';

        if (state.status === 'checking') {
            bgStyle = 'rgba(42, 58, 80, 0.85)';
            textStyle = '#E0E6ED';
            borderStyle = '1px solid rgba(82, 139, 218, 0.4)';
            iconHtml = '<span class="ipv6-spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #528ADA; border-top-color:transparent; border-radius:50%; animation:ipv6-spin 0.8s linear infinite;"></span>';
        } else if (state.status === 'success') {
            bgStyle = 'rgba(21, 87, 36, 0.85)';
            textStyle = '#D4EDDA';
            borderStyle = '1px solid rgba(40, 167, 69, 0.5)';
            iconHtml = '<span style="color:#28A745; font-size:15px; font-weight:bold;">✓</span>';
        } else {
            bgStyle = 'rgba(114, 28, 36, 0.85)';
            textStyle = '#F8D7DA';
            borderStyle = '1px solid rgba(220, 53, 69, 0.5)';
            iconHtml = '<span style="color:#DC3545; font-size:15px; font-weight:bold;">⚠️</span>';
        }

        badge.style.backgroundColor = bgStyle;
        badge.style.color = textStyle;
        badge.style.border = borderStyle;

        var contentHtml = '<div>' +
            '<div style="display:flex; align-items:center; gap:6px;">' +
            iconHtml +
            '<span style="font-weight:600;">' + state.message + '</span>' +
            '</div>';

        if (state.ip) {
            contentHtml += '<div style="font-size:11px; opacity:0.85; margin-top:2px;">IPv6 Address: ' + state.ip + '</div>';
        } else if (state.status === 'warning') {
            contentHtml += '<div style="font-size:11px; opacity:0.85; margin-top:2px;">JVB requires IPv6 (JVB_ADVERTISE_IPS). Audio/video may not connect.</div>';
        }

        contentHtml += '</div>';
        badge.innerHTML = contentHtml;

        // Inject keyframes animation for spinner if not present
        if (!document.getElementById('ipv6-badge-styles')) {
            var styleEl = document.createElement('style');
            styleEl.id = 'ipv6-badge-styles';
            styleEl.innerHTML = '@keyframes ipv6-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(styleEl);
        }

        // Attach to DOM if prejoin/lobby container is found
        var container = document.querySelector('.prejoin-input-area') ||
                        document.querySelector('.prejoin-preview-dropdown') ||
                        document.querySelector('[class*="prejoin-input"]') ||
                        document.querySelector('[class*="prejoin-actions"]') ||
                        document.querySelector('[class*="prejoin-dialog"]') ||
                        document.querySelector('[class*="prejoin"]') ||
                        document.getElementById('react');

        if (container && !container.contains(badge)) {
            if (container.firstChild) {
                container.insertBefore(badge, container.firstChild);
            } else {
                container.appendChild(badge);
            }
        }
    }

    function initObserver() {
        var observer = new MutationObserver(function () {
            updateUI();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        updateUI();
    }

    // Start IPv6 test immediately
    performIPv6Check();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initObserver);
    } else {
        initObserver();
    }
})();
