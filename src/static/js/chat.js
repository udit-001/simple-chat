var recentChatroom = '';
var recentChatroomId = null;
var unreadMsgCount = 0;
var list_of_people_typing = [];
var recentlyViewedMsgTime = '';
var users = {};
document.addEventListener('DOMContentLoaded', function () {
    // document.querySelector('#chat').style.height = window.innerHeight + 'px';
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark");
        document.querySelector('#theme').innerHTML = `Light Theme <i class="fas fa-adjust" style="padding-left:5px;"></i>`;
    }

    var socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    var pageTitleNotification = (() => {
        var config = {
            currentTitle: null,
            interval: null
        };

        var on = (notificationText, intervalSpeed) => {
            if (config.interval === null) {
                config.currentTitle = document.title;
                config.interval = window.setInterval(() => {
                    document.title = document.title === config.currentTitle ?
                        notificationText ? notificationText : "You have a new message!" : config.currentTitle;
                }, intervalSpeed ? intervalSpeed : 1000);
            }
        };

        var off = () => {
            if (config.interval !== null) {
                window.clearInterval(config.interval);
                document.title = config.currentTitle;
                config.interval = null;
            };
        };

        return {
            on: on,
            off: off
        };
    })();

    //Adding typing indicator
    socket.on('someone is typing', function (data) {
        if (recentChatroom === data['room']) {
            if (!list_of_people_typing.includes(data['username'])) {
                list_of_people_typing.push(data['username']);
                setTypingStatus(list_of_people_typing);
                setTimeout(typingTimer, 8000, data['username']);
            }
        }
    });

    socket.on('new dm', function () {
        socket.emit('get users', {
            'user': localStorage.username
        });
    });

    $("#ex1").emojioneArea({
        pickerPosition: "top",
        filtersPosition: "top",
        placeholder: "Type a message",
        searchPlaceholder: "Search",
        tones: false,
        textcomplete: {
            maxCount: 3,
            placement: 'top'
        },
        events: {
            keyup: function (editor, event) {
                if ($("#ex1")[0].emojioneArea.getText().length <= 0) {
                    document.querySelector("#send").disabled = true;
                } else {
                    document.querySelector("#send").disabled = false;
                }
                if (event.which == 13) {
                    if ($("#ex1")[0].emojioneArea.getText().length > 0) {
                        $("#send").click();
                    }
                }
            },
            keypress: function (editor, event) {
                socket.emit('typing', {
                    'room': recentChatroom,
                    'username': localStorage.getItem('username')
                });
            }
        }
    });

    function typingTimer(name) {
        var index = list_of_people_typing.indexOf(name);
        list_of_people_typing.splice(index, 1);
        document.querySelector('#typing').style.display = 'none';
        document.querySelector('.chat-section').classList.remove('-typing');
    }

    function setTypingStatus(list_of_people_typing) {
        var length = list_of_people_typing.length;
        var content = '';
        if (length === 0) {
            document.querySelector('#typing').style.display = 'none';
            document.querySelector('.chat-section').classList.remove('-typing');
            return;
        }
        if (length <= 3) {
            for (i = 0; i < length; i++) {
                if (i === 0 && length === 1) {
                    content += list_of_people_typing[i] + ' is typing...';
                }
                if (i === 0 && length !== 1) {
                    content += list_of_people_typing[i];
                }
                if (i === 1 && length === 2) {
                    content += ' and ' + list_of_people_typing[i] + ' are typing...';
                }
                if (i === 1 && length !== 2) {
                    content += ' , ' + list_of_people_typing[i];
                }
                if (i === 2) {
                    content += ' and ' + list_of_people_typing[i] + ' are typing...';
                }

            }
        } else {
            content = 'Several people are typing...';
        }
        document.querySelector('.chat-section').classList.add('-typing');
        document.querySelector('#typing').style.display = 'block';
        document.querySelector('#typing').innerText = content;
    }

    //Typing indicator code ends

    //Add channel and broadcast it to other users on the network
    document.querySelector('#add-channel').onclick = function () {
        var url = location.protocol + '//' + document.domain + ':' + location.port + "/channel";

        Swal({
            title: "Create a channel",
            input: "text",
            confirmButtonColor: '#4D384B',
            inputAttributes: {
                autocapitalize: "off",
                placeholder: "e.g. leads"
            },
            showCancelButton: true,
            confirmButtonText: "Create channel",
            showLoaderOnConfirm: true,
            inputValidator: (value) => {
                return new Promise((resolve) => {
                    if (value.length < 100) {
                        resolve()
                    } else {
                        resolve('Must be between 1 and 100 in length')
                    }
                })
            },
            preConfirm: channel => {
                str = channel;
                str = str.replace(/\s+/g, '-').toLowerCase();
                str = str.replace(/[!"#$%&'()*+,\.\/ :;<=>?@[\\\]^_`{|}~]+/g, "");
                channel = str;
                var data = {
                    'channel': `${channel}`
                };
                return fetch(url, {
                        method: "POST",
                        body: JSON.stringify(data),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                    .then(res => res.json())
                    .then(response => {
                        if (response.success === 'false') {
                            if (response.reason === 'Already exists') {
                                Swal.showValidationMessage(`Channel name already in use, try again.`);
                            } else if (response.reason === 'Limit reached') {
                                Swal.showValidationMessage(`Limit reached, more channels cannot be created.`);
                            }
                        } else {

                            const channels = document.querySelector('#channels');

                            const li = document.createElement('li');
                            li.innerHTML = `<i class="fas fa-hashtag fa-xs"></i> ${channel}`;

                            channels.appendChild(li);

                            document.querySelector('#no-of-channels').innerText = `(${channels.children.length})`;

                            addChatRoomClickListeners();

                            socket.emit('new channel', {
                                'room': channel
                            })
                        }
                    })
                    .catch(error => {
                        Swal.showValidationMessage(`Channel could not be created: ${error}`);
                    });
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then(result => {
            if (result.value) {
                Swal({
                    title: `Channel created successfully!`,
                    type: 'success'
                });
            }
            document.querySelector('#chat').removeAttribute('style');
            document.querySelector('#channels').children[document.querySelector('#channels').children.length - 1].click();
        });
    }

    //Listen to new channel created event and append it to the list of channels for everyone
    socket.on('channel created', function (data) {
        try {
            document.querySelector('#channels').innerHTML = '';
            for (i = 0; i < data['channels'].length; i++) {
                const channels = document.querySelector('#channels');

                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-hashtag fa-xs"></i> ${data['channels'][i]}`;

                channels.appendChild(li);
            }
            document.querySelector('#no-of-channels').innerText = `(${data['channels'].length})`;

            addChatRoomClickListeners();
            document.querySelector('#chat').removeAttribute('style');
            if (document.querySelector('.selected-li') === null) {}
        } catch (err) {
            console.error(err.message);
        }
    });


    socket.on('total channels', function (data) {
        try {
            if (data['channels'].length <= 0) {
                document.querySelector('#no-channel').style.display = 'flex';
            } else {
                document.querySelector('#chat').removeAttribute('style');
            }
            document.querySelector('#channels').innerHTML = '';
            for (i = 0; i < data['channels'].length; i++) {
                const channels = document.querySelector('#channels');

                const li = document.createElement('li');
                li.innerHTML = `<i class="fas fa-hashtag fa-xs"></i> ${data['channels'][i][1]}`;
                li.dataset.channel_id = data['channels'][i][0];

                channels.appendChild(li);
            }
            document.querySelector('#no-of-channels').innerText = `(${data['channels'].length})`;

            addChatRoomClickListeners();
            document.querySelector('#channels').children[0].click();
            var channelsList = document.querySelector('#channels').children;
            for (i = 0; i < channelsList.length; i++) {
                if (channelsList[i].innerText.trim() === data.recentChatroom) {
                    document.querySelector('.messages-wrapper').innerHTML = '';
                    channelsList[i].click();
                    document.querySelector('#sidebar').style.height = window.innerHeight + 'px';
                    document.querySelector('#chat').style.height = window.innerHeight + 'px';
                }
            }
        } catch (err) {
            console.error(err.message);
        }
    });

    socket.on('total users', function (data) {
        try {
            document.querySelector('#users').innerHTML = '';
            const users = document.querySelector('#users');
            for (i = 0; i < data['users'].length; i++) {
                const li = document.createElement('li');
                if (data['users'][i] === localStorage.getItem('username')) {
                    li.innerHTML = `<i class="fas fa-heart fa-xs"></i> ${data['users'][i]}(Me)`;
                    document.querySelector('#users').insertBefore(li, users.firstChild);
                } else {
                    li.innerHTML = `<i class="fas fa-heart fa-xs"></i> ${data.users[i][1]}`;
                    li.dataset.channel_id = data.users[i][0];
                    document.querySelector('#users').appendChild(li);
                }
            }
            addChatRoomClickListeners();
            document.querySelector('#no-of-users').innerText = `(${data['users'].length})`;
        } catch (err) {
            console.error(err.message);
        }
    });


    document.querySelector("#send").disabled = true;
    const username = localStorage.getItem('username');


    socket.on('connect', function (data) {
        try {
            socket.emit('server connect', {
                'id': socket.id,
                'username': localStorage.username
            });
            document.querySelector("#send").onclick = function () {
                const username = localStorage.getItem('username');
                const room = recentChatroom;
                const message = $("#ex1")[0].emojioneArea.getText().replace(/\s\s+/g, ' ');
                socket.emit('send message', {
                    'username': username,
                    'message': message,
                    'room': recentChatroom,
                    'roomId': recentChatroomId,
                    'type': 'text',
                    'utc': Date.now()
                });
                $("#ex1")[0].emojioneArea.setText('');
                document.querySelector("#send").disabled = true;
                if (!localStorage.getItem('soundOff')) {
                    var x = document.getElementById("sent-message");
                    x.play();
                    console.log('Sound was played');
                }
                return false;
            }
            socket.emit('get channels');

            socket.emit('get users', {
                'user': localStorage.username
            });

            socket.emit('new user', {
                'user': localStorage.getItem('username')
            });

        } catch (err) {
            console.error(err.message);
        }

    });

    var private_socket = io('/private');

    private_socket.on('new_private_message', function (data) {
        console.log(`${data.sender} says ${data.message}`);
    })

    socket.on('user joined', function (data) {
        users[data['username']] = data['id'];
    });

    socket.on('user left', function (data) {
        try {
            document.querySelector('#users').innerHTML = '';
            const users = document.querySelector('#users');
            for (i = 0; i < data['users'].length; i++) {
                const li = document.createElement('li');
                if (data['users'][i] === localStorage.getItem('username')) {
                    li.innerHTML = `<i class="fas fa-heart fa-xs"></i> ${data['users'][i]}(Me)`;
                    users.insertBefore(li, users.firstChild);
                } else {
                    li.innerHTML = `<i class="fas fa-heart fa-xs"></i> ${data['users'][i]}`;
                    users.appendChild(li);
                }
            }
            if (data['user'] === localStorage.getItem('username')) {
                localStorage.removeItem('username');
                document.location.pathname = '/';
            }
        } catch (err) {
            console.error(err.message);
        }
    });



    socket.on('announce message', function (data) {
        try {
            var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            if (recentChatroomId === data.roomId) {

                const message_wrapper = document.querySelector('.messages-wrapper');

                const div = document.createElement('div')
                div.setAttribute('class', 'message-div');

                const avatar = document.createElement('img');
                avatar.setAttribute('class', 'avatar img-body');
                avatar.setAttribute('src', `https://www.gravatar.com/avatar/${data.md5}?d=identicon&s=50`);

                const message = document.createElement('div');
                message.setAttribute('class', 'message');

                const nameTimeDiv = document.createElement('div');

                const nameH4 = document.createElement('h4');
                nameH4.setAttribute('class', 'inline-block');
                nameH4.innerText = data.username;

                const timeH6 = document.createElement('h6');
                timeH6.setAttribute('class', 'inline-block');
                console.log(data.utc);
                timeH6.innerText = moment.tz(data.utc, timezone).calendar();

                nameTimeDiv.appendChild(nameH4);
                nameTimeDiv.appendChild(timeH6);

                message.appendChild(nameTimeDiv);

                const p = document.createElement('p');
                p.setAttribute('class', 'text-body');

                if (data.is_file == true) {
                    p.innerHTML = `has sent an attachment : <a class="attachment" href="${data.message}" download='${data.file_name}' title='Download ${data.file_name}'>${data.file_name}</a>`;
                } else {
                    p.innerText = data.message;
                }


                message.appendChild(p);

                div.appendChild(avatar);
                div.appendChild(message);

                shouldScroll = Math.floor(message_wrapper.scrollTop + message_wrapper.clientHeight) === message_wrapper.scrollHeight;

                message_wrapper.appendChild(div);

                if (shouldScroll) {
                    div.scrollIntoView({
                        block: 'start',
                        behavior: 'smooth'
                    });
                    recentlyViewedMsgTime = timeH6.innerText;
                    document.querySelector('#unread').style.display = 'none';
                    document.querySelector('.chat-section').classList.remove('-unread');
                } else {
                    ++unreadMsgCount;
                    document.querySelector('#unread').style.display = 'block';
                    document.querySelector('.chat-section').classList.add('-unread');
                    document.querySelector('#unread').innerHTML = `<i class="fas fa-long-arrow-alt-up" id="scrollUp"></i>${unreadMsgCount} new messages since ${recentlyViewedMsgTime}`;
                }

                if (document.hidden) {
                    pageTitleNotification.on();
                }

                if (list_of_people_typing.includes(data.username)) {
                    var index = list_of_people_typing.indexOf(name);
                    list_of_people_typing.splice(index, 1);
                    setTypingStatus(list_of_people_typing);
                }

                if (!localStorage.getItem('soundOff')) {
                    if (data.username !== localStorage.getItem('username')) {
                        var x = document.getElementById("new-message");
                        x.play();
                        console.log('Sound was played');
                    }
                }

            } else {
                const channelList = document.querySelector('#channels').children;
                for (i = 0; i < channelList.length; i++) {
                    if (channelList[i].innerText === data.room) {
                        channelList[i].style.color = 'white';
                    }
                }
            }

        } catch (err) {
            console.error(err.message);
        }
    });

    socket.on('total messages', function (data) {
        try {
            var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            begNote = '';
            if (recentChatroom.includes(localStorage.username)) {
                begNote = `This is the beginning of your direct message history with ${document.querySelector('#currentRoom').innerText.replace('# ','@')}.`;
            } else {
                begNote = `Welcome to the beginning of ${document.querySelector('#currentRoom').innerText.replace('# ','#')} channel.`;
            }
            beg = document.createElement('div');
            beg.setAttribute('class', 'beg');
            beg.innerText = begNote;
            document.querySelector('.messages-wrapper').appendChild(beg);
            for (i = 0; i < data.length; i++) {

                const message_wrapper = document.querySelector('.messages-wrapper');

                const div = document.createElement('div')
                div.setAttribute('class', 'message-div');

                const avatar = document.createElement('img');
                avatar.setAttribute('class', 'avatar img-body');
                avatar.setAttribute('src', `https://www.gravatar.com/avatar/${data[i][5]}?d=identicon&s=50`);

                const message = document.createElement('div');
                message.setAttribute('class', 'message');

                const nameTimeDiv = document.createElement('div');

                const nameH4 = document.createElement('h4');
                nameH4.setAttribute('class', 'inline-block');
                nameH4.innerText = data[i][4];

                const timeH6 = document.createElement('h6');
                timeH6.setAttribute('class', 'inline-block');
                timeH6.innerText = moment.tz(data[i][2], timezone).calendar();

                nameTimeDiv.appendChild(nameH4);
                nameTimeDiv.appendChild(timeH6);

                message.appendChild(nameTimeDiv);

                const p = document.createElement('p');
                p.setAttribute('class', 'text-body');

                if (data[i][6] == 1) {
                    p.innerHTML = `has sent an attachment : <a class="attachment" href="${data[i][1]}" download='${data[i][7]}' title='Download ${data[i][7]}'>${data[i][7]}</a>`;
                } else {
                    p.innerText = data[i][1];
                }

                message.appendChild(p);

                div.appendChild(avatar);
                div.appendChild(message);

                message_wrapper.appendChild(div);

                addPrivateChatClickListeners();
            }
        } catch (err) {
            console.error(err.message);
        }
        document.querySelector('.messages-wrapper').scrollTop = document.querySelector('.messages-wrapper').scrollHeight;
        recentlyViewedMsgTime = document.querySelector('.messages-wrapper>.message-div:last-child h6').innerText;
    });

    function addChatRoomClickListeners() {
        document.querySelectorAll('ul#channels > li').forEach(function (li) {
            try {
                li.onclick = function (e) {
                    var state = {
                        channel: e.target.innerText.replace('#', '').trim()
                    }
                    history.pushState(state, e.target.innerText, '/chat/' + e.target.dataset.channel_id);
                    document.querySelector('#chat').removeAttribute('style');
                    document.querySelector('.messages-wrapper').innerHTML = '';
                    document.querySelector('#chat').style.height = window.innerHeight + 'px';
                    document.querySelector('#currentRoom').innerText = `#${li.innerText}`;

                    socket.emit('subscribe', {
                        'room': li.innerText.trim(),
                        'username': localStorage.getItem('username')
                    });

                    document.querySelectorAll('.selected-li').forEach(function (sel) {
                        sel.classList.remove('selected-li');
                    })

                    li.classList.add('selected-li');
                    recentChatroom = li.innerText.trim();
                    recentChatroomId = li.dataset.channel_id;
                    document.title = `${li.innerText} | Flack : A Chat App`;

                    socket.emit('get messages', {
                        'room': recentChatroomId
                    });

                    if (Boolean($("#ex1")[0].emojioneArea.editor)) {
                        $("#ex1")[0].emojioneArea.editor.focus();
                    }

                    if ($(window).width() <= 800) {
                        $("#sidebar").hide("slide", 500);
                        $("#ui-dismiss").hide("fade", 500);
                    }
                }

            } catch (err) {
                console.error(err.message);
            }
            // checkIfUserLoggedIn();
        });
        document.querySelectorAll('ul#users > li').forEach(function (li) {
            try {
                li.onclick = function (e) {
                    var state = {
                        channel: e.target.innerText.replace('#', '').trim()
                    }
                    history.pushState(state, e.target.innerText, '/chat/' + e.target.dataset.channel_id);

                    document.querySelector('#chat').removeAttribute('style');
                    document.querySelector('.messages-wrapper').innerHTML = '';
                    document.querySelector('#chat').style.height = window.innerHeight + 'px';
                    document.querySelector('#currentRoom').innerText = `#${li.innerText}`;

                    document.querySelectorAll('.selected-li').forEach(function (sel) {
                        sel.classList.remove('selected-li');
                    })

                    li.classList.add('selected-li');
                    recentChatroom = li.innerText.trim();
                    recentChatroomId = li.dataset.channel_id;
                    document.title = `${li.innerText} | Flack : A Chat App`;

                    socket.emit('get messages', {
                        'room': recentChatroomId
                    });

                    if (Boolean($("#ex1")[0].emojioneArea.editor)) {
                        $("#ex1")[0].emojioneArea.editor.focus();
                    }

                    if ($(window).width() <= 800) {
                        $("#sidebar").hide("slide", 500);
                        $("#ui-dismiss").hide("fade", 500);
                    }

                    parties = Array(localStorage.username, li.innerText.trim());
                    parties.sort();

                    recentChatroom = parties.join('-');

                    socket.emit('subscribe', {
                        'room': recentChatroom,
                        'username': localStorage.getItem('username')
                    });

                    document.querySelector("#send").onclick = function () {
                        const username = localStorage.getItem('username');
                        const room = recentChatroom;
                        const message = $("#ex1")[0].emojioneArea.getText().replace(/\s\s+/g, ' ');
                        socket.emit('send message', {
                            'username': username,
                            'message': message,
                            'room': recentChatroom,
                            'roomId': recentChatroomId,
                            'type': 'text',
                            'utc': Date.now()
                        });
                        us = document.querySelector('#currentRoom').innerText.replace('#', '').trim();
                        socket.emit('notify user', {
                            'room': users[us]
                        });
                        $("#ex1")[0].emojioneArea.setText('');
                        document.querySelector("#send").disabled = true;
                        // checkIfUserLoggedIn();
                        if (!localStorage.getItem('soundOff')) {
                            var x = document.getElementById("sent-message");
                            x.play();
                            console.log('Sound was played');
                        }
                        return false;
                    }
                }

            } catch (err) {
                console.error(err.message);
            }
        });
    }

    function addPrivateChatClickListeners() {
        document.querySelectorAll('h4.inline-block').forEach(function (h4) {
            h4.onclick = function () {
                if (h4.innerText === localStorage.username) {
                    return;
                }
                document.title = `${h4.innerText} | Flack : A Chat App`;
                document.querySelector('#currentRoom').innerText = `#${h4.innerText}`;
                document.querySelector('.messages-wrapper').innerHTML = '';

                document.querySelectorAll('.selected-li').forEach(function (sel) {
                    sel.classList.remove('selected-li');
                })

                parties = Array(localStorage.username, h4.innerText);
                parties.sort();

                recentChatroom = parties.join('-');

                fetch('/channel', {
                        method: 'POST',
                        body: JSON.stringify({
                            'channel': recentChatroom,
                            'private': true
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }).then(res => res.json())
                    .then(response => {
                        if (response.success === 'true') {
                            recentChatroomId = response.channel_id;
                            document.title = `${h4.innerText} | Flack : A Chat App`;
                            document.querySelectorAll('.selected-li').forEach(function (sel) {
                                sel.classList.remove('selected-li');
                            })
                            beg = document.createElement('div');
                            beg.setAttribute('class', 'beg');
                            beg.innerText = `This is the beginning of your direct message history with ${document.querySelector('#currentRoom').innerText.replace('# ','@')}.`;
                            document.querySelector('.messages-wrapper').appendChild(beg);
                            li = document.createElement('li');
                            li.innerHTML = `<i class="fas fa-heart fa-xs"></i> ${h4.innerText}`;
                            li.setAttribute('class', 'selected-li');
                            li.dataset.channel_id = recentChatroomId;
                            var state = {
                                channel: h4.innerText
                            }
                            history.pushState(state, h4.innerText, '/chat/' + recentChatroomId);
                            li.onclick = function (e) {
                                socket.emit('get messages', {
                                    'room': recentChatroomId
                                });
                                var state = {
                                    channel: e.target.innerText.replace('#', '').trim()
                                }
                                history.pushState(state, e.target.innerText, '/chat/' + e.target.dataset.channel_id);
                                document.querySelector('#currentRoom').innerText = `#${li.innerText}`;
                                document.title = `${li.innerText} | Flack : A Chat App`;
                                recentChatroomId = li.dataset.channel_id;
                                parties = Array(localStorage.username, li.innerText.trim());
                                parties.sort();

                                recentChatroom = parties.join('-');
                                document.querySelector('.messages-wrapper').innerHTML = '';
                            }
                            var usersList = document.querySelector('#users');
                            usersList.appendChild(li);
                            li.scrollIntoView({
                                block: 'start',
                                behavior: 'smooth'
                            });
                            socket.emit('subscribe', {
                                'room': recentChatroom,
                                'username': localStorage.getItem('username')
                            });
                            document.querySelector('#no-of-users').innerText = `(${document.querySelectorAll('ul#users > li').length})`;
                        }
                    })
                    .catch(error => console.error('Error:', error));

                for (const a of document.querySelectorAll("li")) {
                    if (a.textContent.includes(h4.innerText)) {
                        if (a) {
                            a.scrollIntoView({
                                block: 'start',
                                behavior: 'smooth'
                            });
                            a.click();
                        } else {
                            console.log('Existing conversation not found!');
                        }
                    }
                }
            }
        })
    }

    $('.header').click(function () {
        var header = $(this);
        if (header.children(':first-child').hasClass('fa-angle-down')) {
            header.children(':first-child').removeClass('fa-angle-down');
            header.children(':first-child').addClass('fa-angle-right');
            header.next().hide('blind', 600);

        } else {
            header.children(':first-child').removeClass('fa-angle-right');
            header.children(':first-child').addClass('fa-angle-down');
            header.next().show('blind', 600);
        }
    });

    $('.oc').click(function () {
        if ($(window).width() <= 944) {
            $("#sidebar").toggle("slide");
            $("#ui-dismiss").toggle("fade");
            $("#ui-dismiss").click(function () {
                $("#sidebar").hide("slide");
                $("#ui-dismiss").hide("fade");
            });
            $("body").css("overflow", "hidden");
        }
    });

    $(window).on('resize', function () {
        var win = $(this);
        if (win.width() >= 944) {
            $("#sidebar").show("slide");
        } else {
            $("#sidebar").hide("slide");
        }
    });

    $('body').on('swiperight', function () {
        document.querySelector('.oc').click();
    });

    $('#sidebar').on('swipeleft', function () {
        $("#sidebar").hide("slide");
        $("#ui-dismiss").toggle("fade");
    });

    $('#ui-dismiss').on('swipeleft', function () {
        $("#sidebar").hide("slide");
        $("#ui-dismiss").toggle("fade");
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            pageTitleNotification.off();
        }
    });

    $("#unread").click(function () {
        document.querySelector('.messages-wrapper').scrollTop = document.querySelector('.messages-wrapper').scrollHeight;
        document.querySelector("#unread").style.display = 'none';
        document.querySelector('.chat-section').classList.remove('-unread');
        unreadMsgCount = 0;
        recentlyViewedMsgTime = '';
    });

    $("#theme").click(function () {
        document.body.classList.toggle('dark');
        if (document.body.classList.contains('dark')) {
            localStorage.setItem("theme", "dark");
            document.querySelector('.themeTxt').innerHTML = `Light Theme`;
        } else {
            localStorage.setItem("theme", "light");
            document.querySelector('.themeTxt').innerHTML = `Dark Theme`;
        }
    });

    $("#sound").click(function () {
        if (document.querySelector('.fa-volume-mute')) {
            localStorage.setItem("soundOff", 1);
            document.querySelector('#sound').innerHTML = `Sounds On <i class="fas fa-volume-up" style="padding-left:5px;"></i>`;
        } else {
            localStorage.setItem("soundOff", 0);
            document.querySelector('#sound').innerHTML = `Sounds Off <i class="fas fa-volume-mute" style="padding-left:5px;"></i>`;
        }
    });

    $("#log-out").click(function () {
        Swal.fire({
            title: 'Log out',
            text: 'Are you sure you want to logout?',
            showCancelButton: true,
            confirmButtonText: 'Log out',
            confirmButtonColor: '#f04747'
        }).then(result => {
            if (result.value) {
                location.pathname = '/logout';
            }
        })
    });

    $("#upload").click(function () {
        (async function getImage() {
            const {
                value: file
            } = await Swal.fire({
                title: 'Select file',
                input: 'file',
                confirmButtonColor: '#4D384B',
                inputAttributes: {
                    'accept': 'image/*,video/*,audio/*',
                    'aria-label': 'Upload your file'
                }
            })

            if (file) {
                if (file.size > 1048576) {
                    Swal.fire(
                        'Can\'t proceed',
                        'File too large! (Only upto 10mb permitted)',
                        'error'
                    );
                    return;
                }

                const reader = new FileReader
                reader.onload = (e) => {
                    socket.emit('file upload', {
                        'username': username,
                        'message': reader.result,
                        'room': recentChatroom,
                        'roomId': recentChatroomId,
                        'file_name': file.name.split(/[^a-zA-Z0-9\-\_\.]/gi).join('_'),
                        'utc': Date.now(),
                        'is_file': true
                    });

                    Swal.fire({
                        title: 'Done',
                        text: 'Your file was successfully uploaded!',
                        type: 'success',
                        timer: 1500
                    });

                }

                reader.readAsDataURL(file)

            }
        })();
    });


    window.onpopstate = function (event) {
        for (const a of document.querySelectorAll("li")) {
            if (a.textContent.includes(event.state.channel)) {
                if (a) {
                    a.scrollIntoView({
                        block: 'start',
                        behavior: 'smooth'
                    });
                    a.click();
                } else {
                    console.log('Existing conversation not found!');
                }
            }
        }
    };
});