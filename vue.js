//观察者 (发布订阅)
//存放观察者
class Dep{
    constructor(){
        this.subs = []; //存放所有的watcher
        console.log(this.subs)
    }
    addSub(watcher){ //添加watcher
        this.subs.push(watcher);
    }
    notify(){ //发布 通知执行
        this.subs.forEach(watcher => {
            return watcher.update();
        })
    }
}
class Watcher{
    constructor(vm,expr,cb){
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        //默认先把首次定义的数据放到watcher中
        this.oldValue = this.get();
    }
    get(){
        Dep.target = this; 
        //把自己放在全局的target属性上面
        //取值 把观察者和数据关联起来
        let value = CompileUtil.getVal(this.vm,this.expr);
        Dep.target = null; //不取消 任何watcher都会被添加
        return value;
    }
    update(){ //数据变化后 会被调用 更改数值
        let newVal = CompileUtil.getVal(this.vm,this.expr);
        if (newVal !== this.oldValue){
            this.cb(newVal)
        }
    }
}


//实现数据劫持
class Observer{
    constructor(data){
        // console.log(data); // 返回定义的data数据
        this.observer(data)
    }
    observer(data){
        //判断传过来的data类型
        if(data && typeof data == 'object'){
            for (let key in data){
                // 监听数据
                this.defineReactive(data,key,data[key]);
            }
        }
    }
    defineReactive(obj,key,value){
        // 如果传入的值 还是对象 通过递归来再次 劫持
        // 深度递归
        this.observer(value);
        // 给每个属性添加发布订阅
        let dep = new Dep();
        //数据劫持
        Object.defineProperty(obj,key,{
            get(){
                // 调用watcher的时候 就把对应的内存 添加到watcher的全局上
                Dep.target && dep.addSub(Dep.target)
                // console.log(dep)
                return value
            },
            set: (newVal) => {
                // 利用箭头函数 来保证this指向Observer
                //如果新旧值不一样才会更改
                if (value != newVal){
                    //如果school传入一个新的对象 同样需要进行监听 
                    this.observer(newVal);
                    value = newVal;
                    dep.notify() //通知视图更新数据
                };
            }
        })
    }
}
//创建编译器
class Compiler{
    constructor(el,vm){
        //判断el的属性 是不是一个元素
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        //把当前的文档节点 放到内存里
        let fragment = this.node2fragment(this.el);
        // 编译模板
        this.compiler(fragment);
        //把替换好的内容进行替换，并把他放回对应的节点中去
        this.el.appendChild(fragment);
    }
    //编译器
    compiler(node){
        let childNodes = node.childNodes; //拿到的是一个类数组 [text, input, text, div, text, div, text, ul, text]
        //[...childNodes]转成数组
        [...childNodes].forEach(child => {
            if (this.isElementNode(child)){
                //编译元素
                this.compilerElement(child)
                //如果还有子节点 继续向下找 递归
                this.compiler(child)
            } else {
                //编译文本
                this.compilerText(child)
            }
        });
    }
    //处理元素节点
    compilerElement(node){
        let attributes = node.attributes; //类数组
        [...attributes].forEach(attr => {
            // type="text" v-model="school.name"
            //结构 获取对应的类型和值 value:expr设置别名
            let {name,value:expr} = attr;
            if (this.isDirective(name)){
                // v-model
                //获取对应的指令名称
                let [,directive] = name.split('-');
                //v-on:click
                let [directiveName, eventName] = directive.split(':');
                //需要调用不同的指令来处理
                CompileUtil[directiveName](node,expr,this.vm,eventName);
            }
        })
    }
    //处理文本节点
    compilerText(node){
        // 获取文本节点的内容
        let content = node.textContent; 
        // 过来文本节点 去除空节点
        if (/\{\{(.+?)\}\}/.test(content)){
            CompileUtil['text'](node,content,this.vm)
        }
    }
    //判断是否为指令
    isDirective(attrName){
        return attrName.startsWith('v-');
    }
    //把节点移动到内存里
    node2fragment(node){
        let fragment = document.createDocumentFragment(); // 减少重绘
        let firstChild;

        while (firstChild = node.firstChild) {
            //appendChild 具有移动性 添加一个移动一个 所以 可以一直获取他的第一个节点
            fragment.appendChild(firstChild)
        }
        return fragment;
    }
    isElementNode(node){
        return node.nodeType === 1; //1元素节点 3文本节点
    }
}
CompileUtil = {
    //获取对应的$data的值
    getVal(vm,expr){
        return expr.split('.').reduce((data,current) => {
            return data[current]
        },vm.$data);
        /**
        [1,2].reduce((sum,cur) => {
            这个时候 sum就是传入的0 而cur就是数组的第一项1
        },0)
        [1,2].reduce((sum,cur) => {
            这个时候 sum就是传入的1 而cur就是数组的第一项2
        })
        **/
    },
    setValue(vm,expr,value){
        return expr.split('.').reduce((data, current,index,arr) => {
            if (index == arr.length-1){ //判断最后一项
                return data[current] = value;
            }
            return data[current]
        }, vm.$data);
    },
    //解析v-model
    model(node,expr,vm){ //node节点 expr指令对应的表达式school.name vm实例
        let fn = this.updater['modelUpdater'] //更新节点内容
        //给输入框添加观察者
        new Watcher(vm,expr,(newVal) => {
            fn(node,newVal);
        })

        //监听数据变化
        node.addEventListener('input',(e) => {
            let value = e.target.value;
            this.setValue(vm,expr,value);
        })
        let value = this.getVal(vm,expr)
        fn(node,value)
    },
    getContentValue(vm,expr){
        //遍历表达式 将内容重新替换成一个完整的内容 返回
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(vm,args[1]);
        })
    },
    on(node,expr,vm,eventName){
        node.addEventListener(eventName,(e) => {
            /** 
             * vm[expr]
             * change() {
             *      this.school.name = '杭州';
             * }
            */
            vm[expr].call(vm,e);
        })
    },
    text(node,expr,vm){ //expr {{a}}{{b}}
        let fn = this.updater['textUpdater']
        let content = expr.replace(/\{\{(.+?)\}\}/g,(...args) => {
            // args ["{{school.name}}", "school.name", 0, "{{school.name}}"]...
            // 给表达式的每一项都加上观察者 数据一变就更新
            new Watcher(vm,args[1],(newVal) => {
                fn(node,this.getContentValue(vm,expr)); //返回了一个全的字符串
            })
            return this.getVal(vm,args[1])
        })
        fn(node,content)
    },
    html(node,expr,vm){ // v-html="message"
        let fn = this.updater['htmlUpdater'];
        //给输入框添加观察者
        new Watcher(vm, expr, (newVal) => {
            fn(node, newVal);
        })
        let value = this.getVal(vm,expr);
        fn(node, value)
    },
    //更新对应指令的值
    updater:{
        //把数据插入到节点中
        modelUpdater(node,value){
            node.value = value //value 是vm.$data里面的值 赋值给对应的node节点
        },
        textUpdater(node,value){
            node.textContent = value
        },  
        htmlUpdater(node,value){
            node.innerHTML = value
        }
    }
}
//创建基类
class Vue{
    constructor(options){
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods;

        //判断节点是否存在 运行编译
        if (this.$el){
            //数据劫持 Object.defineProperty
            new Observer(this.$data);
            //计算属性 剖析this.$data.getNewName 所以要代理到this.$data
            for (const key in computed) {
                Object.defineProperty(this.$data,key,{
                    get:() => {
                        return computed[key].call(this)
                    }
                })
            };
            for (const key in methods){
                //把methods里面的change事件代理到vm上面
                Object.defineProperty(this,key,{
                    get(){
                        return methods[key]
                    }
                })
            }
            //把vm.$data 代理到vm上
            this.proxyVm(this.$data);
            new Compiler(this.$el,this) //传入节点和vue实例
        }
    }
    //类似于jQuery中的 $ 方便简单 
    proxyVm(data){
        for(let key in data){
            Object.defineProperty(this,key,{
                get(){
                    return data[key]; //进行转化操作
                },
                set(newVal){ //设置代理方法
                    data[key] = newVal; 
                }
            })
        }
    }
}