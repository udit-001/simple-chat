errors = {
    'EMAIL_EXISTS': 'An account with the provided email already exists, try logging in instead.',
    'WEAK_PASSWORD': 'Your password must be at least 6 characters.',
    'INVALID_PASSWORD': 'Email or password is incorrect.',
    'INVALID_EMAIL': 'Please enter a valid email address.',
    'EMAIL_NOT_FOUND': 'We could not found an account for that email address.'
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('button').onclick = function () {
        var username = document.querySelector('#username-field').value;
        var password = document.querySelector('#password-field').value;

        if (document.querySelector('button').id == 'login') {
            endpoint = '/login';
        } else if (document.querySelector('button').id == 'register') {
            if (validatePassword()) {
                //pass
                pass = document.querySelector('#password-field').value;
                if (pass.length >= 6) {
                    //pass
                } else {
                    Swal.fire(
                        'Oops...',
                        'Your password must be at least 6 characters.',
                        'error'
                    );
                    return;
                }
            } else {
                Swal.fire(
                    'Oops...',
                    'Passwords do not match!',
                    'error'
                );
                return;
            }

            name = username.replace(/\s\s+/g, ' ').trim();
            if (/^[a-zA-Z ]{1,18}$/.test(name)) {} else {
                Swal.fire(
                    'Oops...',
                    'Usernames can only contain alphabets, and be 18 characters long',
                    'error'
                );
            }

            endpoint = '/register';
        }
        const request = new XMLHttpRequest();
        request.open('POST', endpoint);

        request.onload = function () {
            const data = JSON.parse(request.responseText);

            if (data.hasOwnProperty('error')) {
                msg = Object.keys(errors).filter(function (error) {
                    if (data['error'].includes(error)) {
                        return errors[error]
                    }
                });
                Swal.fire(
                    'Oops...',
                    errors[msg[0]],
                    'error'
                );
            } else {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 6000
                });

                Toast.fire({
                    type: 'success',
                    title: data['result']
                })
            }

            if (data.success) {
                localStorage.setItem('username', data.username);
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 9000
                });

                Toast.fire({
                    type: 'success',
                    title: data['message']
                });
                window.location.pathname = '/chat';
            } else {
                Swal.fire(
                    'Oops...',
                    data['message'],
                    'error'
                );
            }
            console.log(data);
        }

        const data = new FormData();
        data.append('username', username);
        data.append('password', password);

        request.send(data);
        return false;
    }
    document.querySelector('#toggle-button').onclick = function () {
        if (document.querySelector("button").innerText == "Register Account") {
            // document.querySelector('#name-field').style.display = "none";
            document.querySelector('#cpassword-field').style.display = "none";
            document.querySelector('#switch').innerText = "Do not";
            document.querySelector('#toggle-button').innerText = "Register here";
            document.querySelector("button").innerText = "Login";
            document.querySelector("button").id = "login";
            document.querySelector('#username-field').value = "";
            document.querySelector('#password-field').value = "";
            document.querySelector('#cpassword-field').value = "";
            // document.querySelector('#name-field').value = "";
            document.querySelector('button').disabled = true;
        } else {
            // document.querySelector('#name-field').style.display = "block";
            document.querySelector('#switch').innerText = "Already";
            document.querySelector('#toggle-button').innerText = "Login here";
            document.querySelector("button").innerText = "Register Account";
            document.querySelector("button").id = "register";
            document.querySelector('#username-field').value = "";
            document.querySelector('#password-field').value = "";
            document.querySelector('#cpassword-field').style.display = "block";
            document.querySelector('button').disabled = true;
        }
    };

    function validatePassword() {
        pass = document.querySelector('#password-field').value;
        cpass = document.querySelector('#cpassword-field').value;
        if (pass !== "" && cpass !== "") {
            if (pass !== cpass) {
                return false;
            } else {
                return true;
            }
        }
    }

    function checkEmpty() {
        flag = 0;
        document.querySelectorAll('input').forEach(function (e) {
            if (document.querySelector('button').id === 'login') {
                if (e.name === 'cpassword') {
                    //pass
                } else {
                    if (e.value === "") {
                        flag = 1;
                    }
                }
            } else if (document.querySelector('button').id === 'register') {
                if (e.value === "") {
                    flag = 1;
                }
            }
            if (flag === 1) {
                document.querySelector('button').disabled = true;
            } else {
                document.querySelector('button').disabled = false;
            }
        });
    }
    document.querySelector('#username-field').addEventListener('keyup', checkEmpty);
    document.querySelector('#password-field').addEventListener('keyup', checkEmpty);
    document.querySelector('#cpassword-field').addEventListener('keyup', checkEmpty);
});