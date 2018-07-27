# Creator Smart-Merge Tool

### 为什么设计这个工具?
这个工具主要是提供给广大 Cocos Creator 开发者用户用于合并不同版本或分支下相同的场景内容。对于拥有不同版本开发项目的开发者来说，希望将不同版本的场景数据融合是十分困难的一件事情，因为目前 Cocos Creator 场景文件的数据存储结构对于融合这一概念并不友好（想必很多用户已经体验过了）。为解决这一难题，从而制作了这一个比较简陋的小工具。

### 包含的功能：
- 合并 .fire 后缀的场景文件。
- 合并 .prefab 为后缀的预制体文件。

### 合并原理：
Creator Smart-Merge(以下简称 CSM)工具首先通过识别你当前使用的合并工具在解决冲突时产生的 BASE, LOCAL, REMOTE 三个文件，然后将三个文件相关内容数据进行重新排序。在此基础上，CSM 会调用用户在工程下创建的 mergeConfig.json 文件，通过识别用户配置数据，调用用户习惯使用的第三方冲突解决工具。在用户手动的解决所有期望的调整之后，工具会自动的生成一个新的文件覆盖你当前的冲突场景文件。

### 合并冲突解决工具配置流程：

1. 安装合并工具到全局设置。
   ```
   npm install -g Creator-Smart-Merge
   ``` 
2. 配置你的版本管理工具(目前只支持 SourceTree)，点击 Tools -> Options -> Diff 设置 MergeTool 为 Custom, 并配置 Diff Command 为 node 调用 merge 指令,传入参数设置为：
`$BASE $LOCAL $REMOTE`

### 操作流程：

```
    目前还在试验过程，完成之后会更新对应内容。
```

### 生成的 json 文件数据结构分析：

```
 {
     // 当前生成 json 文件的对比格式。
    "__id__": "cc.Node: Background, id: 0a930RkW5pOkKgXYzQG0cOj",
    "content": {...},    
	"_components": [],
	"_prefabInfos": [],
	"_clickEvent": []
 }
``` 
- \_\_id\_\_：是一个由代码生成的数据唯一标识。合并工具会根据这个唯一标识对数据内容的索引进行位置确认。生成标识的结构针对不同的数据类型会有细微的变化。<br>
- content：为 fire 文件内的原数据内容，但是为了更好的合并 cc.Node 类型去除了 components, prefab 两个数据的索引信息。 <br>
- _prefabInfos：当前节点的 prefab 信息。<br>
- _components：是当前节点的绑定组件内容。<br>
- _clickEvent: 当前点击事件的绑定对象数据。

#### \_\_id\_\_ 标识

```
${_type: String}: ${name: String}, id: ${_id: String}, [index: Number]
```

以上为标识识别格式， SceneAsset、Scene、Node、PrivateNode、Component、CustomeEvent、ClickEvent 都会生成一个类似标识，用于帮助你在合并排查时确认是否是同一对象。


### 可能存在无法解决的问题：

- 比较特殊的冲突问题是针对 _id 数据的比较，目前没有特别好的办法调整。<br>
举例而言，当一个版本场景下增添了一个节点数据，在另一个版本下并没有通过合并的方式修改场景，而是通过手动增添一个同样的节点数据在场景中，这会导致相同的节点数据信息但是拥有不同的 _id 数据，因为新生成的节点都会有相应的唯一 _id 生成。最终，不同的 _id 在对比冲突的过程中会干扰排序，比较，融合等一系列操作。<br>
- 冲突对比过程中，以上结构尽量减少了 \_\_id\_\_ 的存在，想要通过索引信息查找需求对应的数据会比较困难。