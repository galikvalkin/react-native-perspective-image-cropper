import React, { Component } from 'react';
import {
    NativeModules,
    PanResponder,
    Dimensions,
    Image,
    View,
    Animated,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const getWidth = (props) => (
    props.viewHeight ? props.viewHeight * props.width / props.height : Dimensions.get('window').width
);

const getHorizontalPadding = (props) => (
    (Dimensions.get('window').width - getWidth(props)) / 2
);

class CustomCrop extends Component {
    constructor(props) {
        super(props);
        this.state = {
            viewHeight: props.viewHeight || Dimensions.get('window').width * (props.height / props.width),
            height: props.height,
            width: props.width,
            image: props.initialImage,
            moving: false,
        };

        this.state = {
            ...this.state,
            topLeft: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? this.imageCoordinatesToViewCoordinates(
                          props.rectangleCoordinates.topLeft,
                          true,
                      )
                    : { x: 100, y: 100 },
            ),
            topRight: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? this.imageCoordinatesToViewCoordinates(
                          props.rectangleCoordinates.topRight,
                          true,
                      )
                    : { x: getWidth(props) - 100, y: 100 },
            ),
            bottomLeft: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? this.imageCoordinatesToViewCoordinates(
                          props.rectangleCoordinates.bottomLeft,
                          true,
                      )
                    : { x: 100, y: this.state.viewHeight - 100 },
            ),
            bottomRight: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? this.imageCoordinatesToViewCoordinates(
                          props.rectangleCoordinates.bottomRight,
                          true,
                      )
                    : {
                          x: getWidth(props) - 100,
                          y: this.state.viewHeight - 100,
                      },
            ),
        };
        console.log('this.state.topLeft.x._value: ', this.state.topLeft.x._value)
        const pH = getHorizontalPadding(props);
        this.state = {
            ...this.state,
            overlayPositions: `${this.state.topLeft.x._value - pH},${
                this.state.topLeft.y._value
            } ${this.state.topRight.x._value - pH},${this.state.topRight.y._value} ${
                this.state.bottomRight.x._value - pH
            },${this.state.bottomRight.y._value} ${
                this.state.bottomLeft.x._value - pH
            },${this.state.bottomLeft.y._value}`,
        };
        console.log('this.state.overlayPositions: ', this.state.overlayPositions);

        this.panResponderTopLeft = this.createPanResponser(this.state.topLeft);
        this.panResponderTopRight = this.createPanResponser(
            this.state.topRight,
        );
        this.panResponderBottomLeft = this.createPanResponser(
            this.state.bottomLeft,
        );
        this.panResponderBottomRight = this.createPanResponser(
            this.state.bottomRight,
        );
    }

    createPanResponser(corner) {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event([
                null,
                {
                    dx: corner.x,
                    dy: corner.y,
                },
            ]),
            onPanResponderRelease: () => {
                corner.flattenOffset();
                this.updateOverlayString();
            },
            onPanResponderGrant: () => {
                corner.setOffset({ x: corner.x._value, y: corner.y._value });
                corner.setValue({ x: 0, y: 0 });
            },
        });
    }

    crop() {
        const coordinates = {
            topLeft: this.viewCoordinatesToImageCoordinates(this.state.topLeft),
            topRight: this.viewCoordinatesToImageCoordinates(
                this.state.topRight,
            ),
            bottomLeft: this.viewCoordinatesToImageCoordinates(
                this.state.bottomLeft,
            ),
            bottomRight: this.viewCoordinatesToImageCoordinates(
                this.state.bottomRight,
            ),
            height: this.state.height,
            width: this.state.width,
        };

        NativeModules.CustomCropManager.crop(
            coordinates,
            this.state.image,
            (err, res) => this.props.updateImage(res.image, coordinates),
        );
    }

    updateOverlayString() {
        const pH = getHorizontalPadding(this.props);
        this.setState({
            overlayPositions: `${this.state.topLeft.x._value - pH},${
                this.state.topLeft.y._value
            } ${this.state.topRight.x._value - pH},${this.state.topRight.y._value} ${
                this.state.bottomRight.x._value - pH
            },${this.state.bottomRight.y._value} ${
                this.state.bottomLeft.x._value - pH
            },${this.state.bottomLeft.y._value}`,
        });
    }

    imageCoordinatesToViewCoordinates(corner) {
        return {
            x: ((corner.x * getWidth(this.props)) / this.state.width) + getHorizontalPadding(this.props),
            y: (corner.y * this.state.viewHeight) / this.state.height,
        };
    }

    viewCoordinatesToImageCoordinates(corner) {
        return {
            x:
                (((corner.x._value - getHorizontalPadding(this.props)) / getWidth(this.props)) *
                this.state.width),
            y: (corner.y._value / this.state.viewHeight) * this.state.height,
        };
    }

    render() {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                }}
            >
                <View
                    style={[
                        s(this.props).cropContainer,
                        { height: this.state.viewHeight },
                        
                    ]}
                >
                    <Image
                        style={[
                            s(this.props).image,
                            { height: this.state.viewHeight },
                        ]}
                        resizeMode="contain"
                        source={{ uri: this.state.image }}
                    />
                    <Svg
                        height={this.state.viewHeight}
                        width={getWidth(this.props)}
                        style={s(this.props).polygon}
                    >
                        <AnimatedPolygon
                            ref={(ref) => (this.polygon = ref)}
                            fill={this.props.overlayColor || 'blue'}
                            fillOpacity={this.props.overlayOpacity || 0.5}
                            stroke={this.props.overlayStrokeColor || 'blue'}
                            points={this.state.overlayPositions}
                            strokeWidth={this.props.overlayStrokeWidth || 3}
                        />
                    </Svg>
                    <Animated.View
                        {...this.panResponderTopLeft.panHandlers}
                        style={[
                            this.state.topLeft.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        <View
                            style={[
                                s(this.props).handlerI,
                                { left: -10, top: -10 },
                                s(this.props).handlerTopLeft,
                            ]}
                        />
                        <View
                            style={[
                                s(this.props).handlerRound,
                                { left: 50, top: 50 },
                            ]}
                        />
                    </Animated.View>
                    <Animated.View
                        {...this.panResponderTopRight.panHandlers}
                        style={[
                            this.state.topRight.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        <View
                            style={[
                                s(this.props).handlerI,
                                { left: -30, top: -10 },
                                s(this.props).handlerTopLeft,
                                s(this.props).handlerTopRight,
                            ]}
                        />
                        <View
                            style={[
                                s(this.props).handlerRound,
                                { right: 90, top: 50 },
                            ]}
                        />
                    </Animated.View>
                    <Animated.View
                        {...this.panResponderBottomLeft.panHandlers}
                        style={[
                            this.state.bottomLeft.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        <View
                            style={[
                                s(this.props).handlerI,
                                { left: -10, top: -30 },
                                s(this.props).handlerTopLeft,
                                s(this.props).handlerBottomLeft,
                            ]}
                        />
                        <View
                            style={[
                                s(this.props).handlerRound,
                                { left: 50, bottom: 90 },
                            ]}
                        />
                    </Animated.View>
                    <Animated.View
                        {...this.panResponderBottomRight.panHandlers}
                        style={[
                            this.state.bottomRight.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        <View
                            style={[
                                s(this.props).handlerI,
                                { left: -30, top: -30 },
                                s(this.props).handlerTopLeft,
                                s(this.props).handlerBottomRight,
                            ]}
                        />
                        <View
                            style={[
                                s(this.props).handlerRound,
                                { right: 90, bottom: 90 },
                            ]}
                        />
                    </Animated.View>
                </View>
            </View>
        );
    }
}

const s = (props) => ({
    handlerI: {
        borderRadius: 0,
        height: 20,
        width: 20,
        backgroundColor: props.handlerColor || 'blue',
    },
    handlerTopLeft: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderRightWidth: 20,
        borderTopWidth: 20,
        borderRightColor: 'transparent',
        borderTopColor: props.handlerColor
    },
    handlerTopRight: {
        transform: [
            {rotate: '90deg'}
        ]
    },
    handlerBottomLeft: {
        transform: [
            {rotate: '270deg'}
        ]
    },
    handlerBottomRight: {
        transform: [
            {rotate: '180deg'}
        ]
    },
    handlerRound: {},
    image: {
        width: getWidth(props),
        ...(!props.viewHeight ? { position: 'absolute' } : {}),
    },
    bottomButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'blue',
        width: 70,
        height: 70,
        borderRadius: 100,
    },
    handler: {
        height: 140,
        width: 140,
        overflow: 'visible',
        marginLeft: -50,
        marginTop: -50,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
    },
    cropContainer: {
        position: 'absolute',
        left: 0,
        width: Dimensions.get('window').width,
        top: 0,
        paddingHorizontal: getHorizontalPadding(props),
    },
    polygon: {
        position: 'absolute',
        left: props.viewHeight ? getHorizontalPadding(props) : 0,
        top: 0,
    }
});

export default CustomCrop;
