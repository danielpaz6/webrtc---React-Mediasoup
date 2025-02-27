import React, { Suspense, lazy } from 'react';
import { Device } from 'mediasoup-client';

const CreateRemoteVideos = (props: any) => {
    const remoteVideo: any = React.useRef();
    React.useEffect(() => {
        // if (remoteVideo.current.srcObject) {
        //     remoteVideo.current.srcObject.addTrack(props.track);
        //         return;
        //     }
        console.log('CreateRemoteVideos');
        console.log(props);
        props
            .playVideo(remoteVideo.current, props.peer.stream)
            .then(() => {
                remoteVideo.current.volume = 1.0;
            })
            .catch((err: any) => {
                console.error('media ERROR:', err);
            });
    }, []);
    return (
        <video
            ref={remoteVideo}
            autoPlay
            style={{
                width: '240px',
                height: '180px',
                border: '1px solid black',
            }}
        ></video>
    );
};

function MeetRoom(props: any) {
    const localVideo: any = React.useRef();
    const localStream: any = React.useRef();
    const clientId: any = React.useRef();
    const device: any = React.useRef();
    const producerTransport: any = React.useRef();
    const videoProducer: any = React.useRef();
    const audioProducer: any = React.useRef();
    const consumerTransport: any = React.useRef();
    const videoConsumers: any = React.useRef({});
    const audioConsumers: any = React.useRef({});
    let socket: any = props.userSocket;

    const [useVideo, setUseVideo] = React.useState(true);
    const [useAudio, setUseAudio] = React.useState(true);
    const [remoteVideos, setRemoteVideos]: any = React.useState({});

    // ============ UI button ==========
    const handleUseVideo = (e: any) => {
        setUseVideo(e.target.value);
    };
    const handleUseAudio = (e: any) => {
        setUseAudio(e.target.value);
    };

    const handleStartMedia = () => {
        if (localStream.current) {
            console.warn('WARN: local media ALREADY started');
            return;
        }

        navigator.mediaDevices
            .getUserMedia({ audio: useAudio, video: useVideo })
            .then((stream: any) => {
                localStream.current = stream;
                playVideo(localVideo.current, localStream.current);
            })
            .catch((err) => {
                console.error('media ERROR:', err);
            });
    };

    function handleStopMedia() {
        if (localStream.current) {
            pauseVideo(localVideo.current);
            stopLocalStream(localStream.current);
            localStream.current = null;
        }
    }

    function handleDisconnect() {
        if (localStream.current) {
            pauseVideo(localVideo.current);
            stopLocalStream(localStream.current);
            localStream.current = null;
        }
        if (videoProducer.current) {
            videoProducer.current.close(); // localStream will stop
            videoProducer.current = null;
        }
        if (audioProducer.current) {
            audioProducer.current.close(); // localStream will stop
            audioProducer.current = null;
        }
        if (producerTransport.current) {
            producerTransport.current.close(); // localStream will stop
            producerTransport.current = null;
        }

        for (const key in videoConsumers.current) {
            const consumer = videoConsumers.current[key];
            consumer.close();
            delete videoConsumers.current[key];
        }
        for (const key in audioConsumers.current) {
            const consumer = audioConsumers.current[key];
            consumer.close();
            delete audioConsumers.current[key];
        }

        if (consumerTransport.current) {
            consumerTransport.current.close();
            consumerTransport.current = null;
        }

        removeAllRemoteVideo();

        disconnectSocket();
    }

    function playVideo(element: any, stream: any) {
        if (element.srcObject) {
            console.warn('element ALREADY playing, so ignore');
            return;
        }
        element.srcObject = stream;
        element.volume = 0;
        return element.play();
    }

    function pauseVideo(element: any) {
        element.pause();
        element.srcObject = null;
    }

    function stopLocalStream(stream: any) {
        let tracks = stream.getTracks();
        if (!tracks) {
            console.warn('NO tracks');
            return;
        }

        tracks.forEach((track: any) => track.stop());
    }

    function addRemoteTrack(id: any, track: any) {
        // let video: any = findRemoteVideo(id);
        // if (!video) {
        //     video = addRemoteVideo(id);
        //     video.controls = '1';
        // }

        // if (video.srcObject) {
        //     video.srcObject.addTrack(track);
        //     return;
        // }

        if (id === clientId.current) {
            return false;
        }

        const newStream = new MediaStream();
        newStream.addTrack(track);

        setRemoteVideos((peers: any) => {
            const newPeers: any = peers;
            newPeers[id] = {
                stream: newStream,
                socket_id: id,
            };
            return { ...peers, ...newPeers };
        });

        // playVideo(video, newStream)
        //     .then(() => {
        //         video.volume = 1.0;
        //     })
        //     .catch((err: any) => {
        //         console.error('media ERROR:', err);
        //     });
    }

    function addRemoteVideo(id: any) {
        let existElement = findRemoteVideo(id);
        if (existElement) {
            console.warn('remoteVideo element ALREADY exist for id=' + id);
            return existElement;
        }

        let element = document.createElement('video');
        return element;
    }

    function findRemoteVideo(id: any) {
        let element = remoteVideos.current[id];
        return element;
    }

    function removeRemoteVideo(id: any) {
        console.log(' ---- removeRemoteVideo() id=' + id);
        let element = document.getElementById('remote_' + id);
        // if (element) {
        //     element.pause();
        //     element.srcObject = null;
        //     remoteContainer.removeChild(element);
        // } else {
        //     console.log('child element NOT FOUND');
        // }
    }

    function removeAllRemoteVideo() {
        // while (remoteContainer.firstChild) {
        //     remoteContainer.firstChild.pause();
        //     remoteContainer.firstChild.srcObject = null;
        //     remoteContainer.removeChild(remoteContainer.firstChild);
        // }
    }

    async function consumeAdd(
        transport: any,
        remoteSocketId: any,
        prdId: any,
        trackKind: any
    ) {
        console.log('--start of consumeAdd -- kind=%s', trackKind);
        const { rtpCapabilities } = device.current;
        //const data = await socket.request('consume', { rtpCapabilities });
        const data = await sendRequest('consumeAdd', {
            rtpCapabilities: rtpCapabilities,
            remoteId: remoteSocketId,
            kind: trackKind,
        }).catch((err) => {
            console.error('consumeAdd ERROR:', err);
        });
        const { producerId, id, kind, rtpParameters }: any = data;
        if (prdId && prdId !== producerId) {
            console.warn('producerID NOT MATCH');
        }

        let codecOptions = {};
        const consumer = await transport.consume({
            id,
            producerId,
            kind,
            rtpParameters,
            codecOptions,
        });
        //const stream = new MediaStream();
        //stream.addTrack(consumer.track);

        addRemoteTrack(remoteSocketId, consumer.track);
        addConsumer(remoteSocketId, consumer, kind);
        consumer.remoteId = remoteSocketId;
        consumer.on('transportclose', () => {
            console.log(
                '--consumer transport closed. remoteId=' + consumer.remoteId
            );
            //consumer.close();
            //removeConsumer(remoteId);
            //removeRemoteVideo(consumer.remoteId);
        });
        consumer.on('producerclose', () => {
            console.log(
                '--consumer producer closed. remoteId=' + consumer.remoteId
            );
            consumer.close();
            removeConsumer(consumer.remoteId, kind);
            removeRemoteVideo(consumer.remoteId);
        });
        consumer.on('trackended', () => {
            console.log('--consumer trackended. remoteId=' + consumer.remoteId);
            //consumer.close();
            //removeConsumer(remoteId);
            //removeRemoteVideo(consumer.remoteId);
        });

        console.log('--end of consumeAdd');
        //return stream;

        if (kind === 'video') {
            console.log('--try resumeAdd --');
            sendRequest('resumeAdd', { remoteId: remoteSocketId, kind: kind })
                .then(() => {
                    console.log('resumeAdd OK');
                })
                .catch((err) => {
                    console.error('resumeAdd ERROR:', err);
                });
        }
    }

    async function handleConnect() {
        if (!localStream.current) {
            console.warn('WARN: local media NOT READY');
            return;
        }

        // --- connect socket.io ---
        // await connectSocket().catch((err) => {
        //     console.error(err);
        //     return;
        // });

        // --- get capabilities --
        const data = await sendRequest('getRouterRtpCapabilities', {});
        console.log('getRouterRtpCapabilities:', data);
        await loadDevice(data);

        // --- get transport info ---
        console.log('--- createProducerTransport --');
        const params = await sendRequest('createProducerTransport', {});
        console.log('transport params:', params);
        producerTransport.current = device.current.createSendTransport(params);
        console.log('createSendTransport:', producerTransport.current);

        // --- join & start publish --
        producerTransport.current.on(
            'connect',
            async ({ dtlsParameters }: any, callback: any, errback: any) => {
                console.log('--trasnport connect');
                sendRequest('connectProducerTransport', {
                    dtlsParameters: dtlsParameters,
                })
                    .then(callback)
                    .catch(errback);
            }
        );

        producerTransport.current.on(
            'produce',
            async (
                { kind, rtpParameters }: any,
                callback: any,
                errback: any
            ) => {
                console.log('--trasnport produce');
                try {
                    const { id }: any = await sendRequest('produce', {
                        transportId: producerTransport.current.id,
                        kind,
                        rtpParameters,
                    });
                    callback({ id });
                    console.log('--produce requested, then subscribe ---');
                    subscribe();
                } catch (err) {
                    errback(err);
                }
            }
        );

        producerTransport.current.on('connectionstatechange', (state: any) => {
            switch (state) {
                case 'connecting':
                    console.log('publishing...');
                    break;

                case 'connected':
                    console.log('published');
                    break;

                case 'failed':
                    console.log('failed');
                    producerTransport.current.close();
                    break;

                default:
                    break;
            }
        });

        if (useVideo) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                const trackParams = { track: videoTrack };
                videoProducer.current = await producerTransport.current.produce(
                    trackParams
                );
            }
        }
        if (useAudio) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                const trackParams = { track: audioTrack };
                audioProducer.current = await producerTransport.current.produce(
                    trackParams
                );
            }
        }
    }

    async function subscribe() {
        // if (!isSocketConnected()) {
        //     await connectSocket().catch((err) => {
        //         console.error(err);
        //         return;
        //     });

        // --- get capabilities --
        const data = await sendRequest('getRouterRtpCapabilities', {});
        console.log('getRouterRtpCapabilities:', data);
        await loadDevice(data);
        //  }

        // --- prepare transport ---
        console.log('--- createConsumerTransport --');
        if (!consumerTransport.current) {
            const params = await sendRequest('createConsumerTransport', {});
            console.log('transport params:', params);
            consumerTransport.current = device.current.createRecvTransport(
                params
            );
            console.log('createConsumerTransport:', consumerTransport.current);

            // --- join & start publish --
            consumerTransport.current.on(
                'connect',
                async (
                    { dtlsParameters }: any,
                    callback: any,
                    errback: any
                ) => {
                    console.log('--consumer trasnport connect');
                    sendRequest('connectConsumerTransport', {
                        dtlsParameters: dtlsParameters,
                    })
                        .then(callback)
                        .catch(errback);
                }
            );

            consumerTransport.current.on(
                'connectionstatechange',
                (state: any) => {
                    switch (state) {
                        case 'connecting':
                            console.log('subscribing...');
                            break;

                        case 'connected':
                            console.log('subscribed');
                            //consumeCurrentProducers(clientId);
                            break;

                        case 'failed':
                            console.log('failed');
                            producerTransport.current.close();
                            break;

                        default:
                            break;
                    }
                }
            );

            consumeCurrentProducers(clientId.current);
        }
    }

    async function loadDevice(routerRtpCapabilities: any) {
        try {
            device.current = new Device();
        } catch (error) {
            if (error.name === 'UnsupportedError') {
                console.error('browser not supported');
            }
        }
        await device.current.load({ routerRtpCapabilities });
    }

    function sendRequest(type: any, data: any) {
        return new Promise((resolve: any, reject: any) => {
            socket.emit(type, data, (err: any, response: any) => {
                if (!err) {
                    // Success response, so pass the mediasoup response to the local Room.
                    resolve(response);
                } else {
                    reject(err);
                }
            });
        });
    }

    async function consumeCurrentProducers(clientId: any) {
        console.log('-- try consuleAll() --');
        const remoteInfo: any = await sendRequest('getCurrentProducers', {
            localId: clientId.current,
        }).catch((err) => {
            console.error('getCurrentProducers ERROR:', err);
            return;
        });
        //console.log('remoteInfo.producerIds:', remoteInfo.producerIds);
        console.log('remoteInfo.remoteVideoIds:', remoteInfo.remoteVideoIds);
        console.log('remoteInfo.remoteAudioIds:', remoteInfo.remoteAudioIds);
        consumeAll(
            consumerTransport.current,
            remoteInfo.remoteVideoIds,
            remoteInfo.remoteAudioIds
        );
    }

    function consumeAll(
        transport: any,
        remoteVideoIds: any,
        remotAudioIds: any
    ) {
        console.log('----- consumeAll() -----');
        remoteVideoIds.forEach((rId: any) => {
            consumeAdd(transport, rId, null, 'video');
        });
        remotAudioIds.forEach((rId: any) => {
            consumeAdd(transport, rId, null, 'audio');
        });
    }

    function disconnectSocket() {
        if (socket) {
            socket.close();
            socket = null;
            clientId.current = null;
            console.log('socket.io closed..');
        }
    }

    function removeConsumer(id: any, kind: any) {
        if (kind === 'video') {
            delete videoConsumers.current[id];
            console.log(
                'videoConsumers count=' +
                    Object.keys(videoConsumers.current).length
            );
        } else if (kind === 'audio') {
            delete audioConsumers.current[id];
            console.log(
                'audioConsumers count=' +
                    Object.keys(audioConsumers.current).length
            );
        } else {
            console.warn('UNKNOWN consumer kind=' + kind);
        }
    }

    function getConsumer(id: any, kind: any) {
        if (kind === 'video') {
            return videoConsumers.current[id];
        } else if (kind === 'audio') {
            return audioConsumers.current[id];
        } else {
            console.warn('UNKNOWN consumer kind=' + kind);
        }
    }

    function addConsumer(id: any, consumer: any, kind: any) {
        if (kind === 'video') {
            videoConsumers.current[id] = consumer;
            console.log(
                'videoConsumers count=' +
                    Object.keys(videoConsumers.current).length
            );
        } else if (kind === 'audio') {
            audioConsumers.current[id] = consumer;
            console.log(
                'audioConsumers count=' +
                    Object.keys(audioConsumers.current).length
            );
        } else {
            console.warn('UNKNOWN consumer kind=' + kind);
        }
    }

    React.useEffect(() => {
        socket.on('message', function (message: any) {
            console.log('socket.io message:', message);
            if (message.type === 'welcome') {
                if (socket.id !== message.id) {
                    console.warn(
                        'WARN: something wrong with clientID',
                        socket.io,
                        message.id
                    );
                }

                clientId.current = message.id;
                console.log(
                    'connected to server. clientId=' + clientId.current
                );
            } else {
                console.error('UNKNOWN message from server:', message);
            }
        });
        socket.on('newProducer', function (message: any) {
            console.log('socket.io newProducer:', message);
            const remoteId = message.socketId;
            const prdId = message.producerId;
            const kind = message.kind;
            if (kind === 'video') {
                console.log(
                    '--try consumeAdd remoteId=' +
                        remoteId +
                        ', prdId=' +
                        prdId +
                        ', kind=' +
                        kind
                );
                consumeAdd(consumerTransport.current, remoteId, prdId, kind);
            } else if (kind === 'audio') {
                //console.warn('-- audio NOT SUPPORTED YET. skip remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
                console.log(
                    '--try consumeAdd remoteId=' +
                        remoteId +
                        ', prdId=' +
                        prdId +
                        ', kind=' +
                        kind
                );
                consumeAdd(consumerTransport.current, remoteId, prdId, kind);
            }
        });

        socket.on('producerClosed', function (message: any) {
            console.log('socket.io producerClosed:', message);
            const localId = message.localId;
            const remoteId = message.remoteId;
            const kind = message.kind;
            console.log(
                '--try removeConsumer remoteId=%s, localId=%s, track=%s',
                remoteId,
                localId,
                kind
            );
            removeConsumer(remoteId, kind);
            removeRemoteVideo(remoteId);
        });
    }, []);

    return (
        <div>
            <div>
                <input
                    onChange={handleUseVideo}
                    type='checkbox'
                    checked={useVideo}
                ></input>
                <label>video</label>
            </div>
            <div>
                <input
                    onChange={handleUseAudio}
                    type='checkbox'
                    checked={useAudio}
                ></input>
                <label>audio</label>
            </div>
            <button onClick={handleStartMedia}>Start Media</button>
            <button onClick={handleStopMedia}>Stop Media</button>

            <button onClick={handleConnect}>Connect</button>
            <button onClick={handleDisconnect}>Disconnect</button>
            <div>
                local video
                <video
                    ref={localVideo}
                    autoPlay
                    style={{
                        width: '240px',
                        height: '180px',
                        border: '1px solid black',
                    }}
                ></video>
            </div>
            <div>remote videos</div>
            {Object.keys(remoteVideos).map((key: any, index: number) => {
                const peer: any = remoteVideos[key];
                return (
                    <CreateRemoteVideos
                        key={peer.socket_id}
                        peer={peer}
                        playVideo={playVideo}
                    />
                );
            })}
        </div>
    );
}

export default MeetRoom;
